import { requireApiUser } from "@/lib/api/auth";
import { requireServiceRunAccess } from "@/lib/api/service-access";
import { createAdminClient } from "@/lib/supabase/server";
import { decideGeofence } from "@/lib/policies/geofence";
import { apiError, apiOk } from "@/lib/api/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;
  const { data: tags, error } = await createAdminClient().from("location_events")
    .select("id, result, distance_meters, configured_radius_meters, received_at_server")
    .eq("service_run_id", id).eq("event_type", "geofence_check")
    .order("received_at_server", { ascending: false }).limit(1);
  if (error) return apiError(500, "INTERNAL_ERROR", "Could not load location tag.");
  return apiOk({ location_tag: tags?.[0] ?? null });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;
  if (access.serviceRun.status !== "ready") {
    return apiError(409, "INVALID_STATE_TRANSITION", "Arrival must be tagged before starting this visit.");
  }
  const body = await request.json().catch(() => null);
  const location = body?.location;
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const accuracy = location?.accuracy_meters;
  const capturedAt = Date.parse(location?.captured_at_device ?? "");
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1000 ||
      !Number.isFinite(capturedAt) || Math.abs(Date.now() - capturedAt) > 10 * 60_000) {
    return apiError(400, "VALIDATION_ERROR", "A current, valid GPS fix is required.");
  }

  const sb = createAdminClient();
  const { data: distanceRows, error: distanceError } = await sb.rpc("calculate_property_geofence_distance", {
    p_property_id: access.serviceRun.work_orders?.property_id,
    p_latitude: latitude,
    p_longitude: longitude,
  });
  const row = distanceRows?.[0];
  if (distanceError || !row) return apiError(409, "LOCATION_REQUIRED", "Property geofence is not configured.");
  const distanceMeters = Number(row.distance_meters);
  const radiusMeters = Number(row.configured_radius_meters);
  const decision = decideGeofence({ distanceMeters, accuracyMeters: accuracy, configuredRadiusMeters: radiusMeters });
  const { data: tag, error } = await sb.from("location_events").insert({
    service_run_id: id,
    work_order_id: access.serviceRun.work_order_id,
    actor_id: auth.user.id,
    event_type: "geofence_check",
    latitude,
    longitude,
    accuracy_meters: accuracy,
    captured_at_device: new Date(capturedAt).toISOString(),
    distance_meters: distanceMeters,
    configured_radius_meters: radiusMeters,
    result: decision.result,
  }).select("id, result, received_at_server").single();
  if (error || !tag) return apiError(500, "INTERNAL_ERROR", "Location tag was not saved.");
  return apiOk({ location_tag: tag, geofence: {
    result: decision.result,
    distance_meters: distanceMeters,
    configured_radius_meters: radiusMeters,
    warning: decision.warning,
  } }, 201);
}
