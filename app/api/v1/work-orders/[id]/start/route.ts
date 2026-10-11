import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
} from "@/lib/api/idempotency";
import { assertServiceStateTransition } from "@/lib/policies/service-state";
import type { ServiceState } from "@/lib/policies/service-state";
import { decideGeofence } from "@/lib/policies/geofence";
import { notifyPrivilegedUsersOfRunEvent } from "@/lib/api/admin-alerts";

interface StartBody {
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id: workOrderId } = await params;
  const body = (await request.json().catch(() => ({}))) as StartBody;
  const idempotency = await beginIdempotentRequest(
    auth.supabase,
    auth.user.id,
    `work-orders:${workOrderId}:start`,
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
    return apiError(400, "LOCATION_REQUIRED", "A complete GPS location fix is required to start work.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  const { data: workOrder, error: workOrderError } = await sb
    .from("work_orders")
    .select("id, property_id, status, template_version_id")
    .eq("id", workOrderId)
    .single();

  if (workOrderError || !workOrder) {
    return apiError(404, "NOT_FOUND", "Work order was not found.");
  }

  const transition = assertServiceStateTransition(workOrder.status as ServiceState, "in_progress");
  if (!transition.ok) {
    return apiError(409, "INVALID_STATE_TRANSITION", transition.message);
  }

  const { data: directAssignment } = await sb
    .from("work_order_assignments")
    .select("id")
    .eq("work_order_id", workOrderId)
    .eq("active", true)
    .eq("assignment_type", "employee")
    .eq("employee_id", auth.user.id)
    .maybeSingle();

  const { data: crewMemberships } = await sb
    .from("crew_members")
    .select("crew_id")
    .eq("employee_id", auth.user.id);
  const crewIds = ((crewMemberships ?? []) as { crew_id: string }[]).map((row) => row.crew_id);

  let crewAssignment = null;
  if (!directAssignment && crewIds.length > 0) {
    const { data } = await sb
      .from("work_order_assignments")
      .select("id")
      .eq("work_order_id", workOrderId)
      .eq("active", true)
      .eq("assignment_type", "crew")
      .in("crew_id", crewIds)
      .maybeSingle();
    crewAssignment = data;
  }

  if (!directAssignment && !crewAssignment) {
    return apiError(403, "ASSIGNMENT_REQUIRED", "You are not assigned to this work order.");
  }

  const { data: distanceRows, error: distanceError } = await sb.rpc(
    "calculate_property_geofence_distance",
    {
      p_property_id: workOrder.property_id,
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

  const now = new Date().toISOString();
  const { data: serviceRun, error: runError } = await sb
    .from("service_runs")
    .insert({
      work_order_id: workOrderId,
      template_version_id: workOrder.template_version_id,
      primary_worker_id: auth.user.id,
      status: "in_progress",
      started_at: now,
    })
    .select("id, status, started_at")
    .single();

  if (runError || !serviceRun) {
    return apiError(500, "INTERNAL_ERROR", "Failed to start service run.");
  }

  await sb
    .from("work_orders")
    .update({ status: "in_progress", updated_by: auth.user.id })
    .eq("id", workOrderId);

  await sb.from("location_events").insert({
    service_run_id: serviceRun.id,
    work_order_id: workOrderId,
    actor_id: auth.user.id,
    event_type: body.override_reason ? "override" : "start",
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
    service_run_id: serviceRun.id,
    event_type: "start",
    actor_id: auth.user.id,
    from_status: workOrder.status,
    to_status: "in_progress",
    metadata: {
      distance_meters: distanceMeters,
      configured_radius_meters: radiusMeters,
      geofence_result: geofence.result,
      override: Boolean(body.override_reason),
    },
  });

  await notifyPrivilegedUsersOfRunEvent({
    event: "start",
    serviceRunId: serviceRun.id,
    workOrderId,
    actorId: auth.user.id,
  });

  const responseBody = {
    service_run: serviceRun,
    geofence: {
      result: body.override_reason ? "override_approved" : geofence.result,
      distance_meters: distanceMeters,
      configured_radius_meters: radiusMeters,
      warning: geofence.warning,
    },
  };

  await completeIdempotentRequest(auth.supabase, idempotency.id, 201, responseBody);

  return apiOk(responseBody, 201);
}
