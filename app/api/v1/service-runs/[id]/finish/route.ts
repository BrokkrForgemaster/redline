import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { beginIdempotentRequest, completeIdempotentRequest } from "@/lib/api/idempotency";
import { requireServiceRunAccess } from "@/lib/api/service-access";
import { decideGeofence } from "@/lib/policies/geofence";
import { notifyPrivilegedUsersOfRunEvent } from "@/lib/api/admin-alerts";

interface FinishBody {
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy_meters?: number;
    captured_at_device?: string;
  };
  override_reason?: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as FinishBody;
  const idempotency = await beginIdempotentRequest(
    auth.supabase,
    auth.user.id,
    `service-runs:${id}:finish`,
    request.headers.get("Idempotency-Key"),
    body
  );
  if (!idempotency.ok) return idempotency.response;

  const location = body.location;
  if (
    !location ||
    !isFiniteNumber(location.latitude) ||
    !isFiniteNumber(location.longitude) ||
    !isFiniteNumber(location.accuracy_meters) ||
    !location.captured_at_device
  ) {
    return apiError(400, "LOCATION_REQUIRED", "A complete GPS location fix is required to finish work.");
  }

  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;
  if (access.serviceRun.status !== "in_progress" && access.serviceRun.status !== "paused") {
    return apiError(409, "INVALID_STATE_TRANSITION", "Only active or paused service runs can be finished.");
  }
  if (access.serviceRun.finished_at) {
    return apiError(409, "CONFLICT_FINALIZED_RECORD", "This service run already has a finish event.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;
  const propertyId = access.serviceRun.work_orders?.property_id;
  const { data: distanceRows, error: distanceError } = await sb.rpc(
    "calculate_property_geofence_distance",
    {
      p_property_id: propertyId,
      p_latitude: location.latitude,
      p_longitude: location.longitude,
    }
  );

  if (distanceError || !distanceRows?.[0]) {
    return apiError(409, "LOCATION_REQUIRED", "Property geofence is not configured.");
  }

  const distanceMeters = Number(distanceRows[0].distance_meters);
  const radiusMeters = Number(distanceRows[0].configured_radius_meters);
  const geofence = decideGeofence({
    distanceMeters,
    accuracyMeters: location.accuracy_meters,
    configuredRadiusMeters: radiusMeters,
    overrideRequested: Boolean(body.override_reason),
    overrideReason: body.override_reason,
  });

  if (geofence.code === "LOCATION_ACCURACY_TOO_LOW") {
    return apiError(409, "LOCATION_ACCURACY_TOO_LOW", geofence.warning);
  }
  if (geofence.code === "OUTSIDE_GEOFENCE") {
    return apiError(409, "OUTSIDE_GEOFENCE", geofence.warning);
  }
  if (geofence.code === "OVERRIDE_REQUIRED" && !body.override_reason) {
    return apiError(409, "OVERRIDE_REQUIRED", geofence.warning);
  }

  const finishedAt = new Date().toISOString();
  const { data: updated, error } = await sb
    .from("service_runs")
    .update({ finished_at: finishedAt, status: "in_progress" })
    .eq("id", id)
    .select("id, status, finished_at")
    .single();

  if (error || !updated) return apiError(500, "INTERNAL_ERROR", "Failed to finish service run.");

  await sb.from("location_events").insert({
    service_run_id: id,
    work_order_id: access.serviceRun.work_order_id,
    actor_id: auth.user.id,
    event_type: body.override_reason ? "override" : "finish",
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy_meters: location.accuracy_meters,
    captured_at_device: location.captured_at_device,
    distance_meters: distanceMeters,
    configured_radius_meters: radiusMeters,
    result: body.override_reason ? "override_approved" : geofence.result,
    override_reason: body.override_reason ?? null,
  });

  await sb.from("service_run_events").insert({
    service_run_id: id,
    event_type: "finish",
    actor_id: auth.user.id,
    from_status: access.serviceRun.status,
    to_status: "in_progress",
    metadata: {
      distance_meters: distanceMeters,
      configured_radius_meters: radiusMeters,
      geofence_result: geofence.result,
      override: Boolean(body.override_reason),
    },
  });

  await notifyPrivilegedUsersOfRunEvent({
    event: "finish",
    serviceRunId: id,
    workOrderId: access.serviceRun.work_order_id,
    actorId: auth.user.id,
  });

  const responseBody = {
    service_run: updated,
    geofence: {
      result: body.override_reason ? "override_approved" : geofence.result,
      distance_meters: distanceMeters,
      configured_radius_meters: radiusMeters,
      warning: geofence.warning,
    },
  };

  await completeIdempotentRequest(auth.supabase, idempotency.id, 200, responseBody);
  return apiOk(responseBody);
}
