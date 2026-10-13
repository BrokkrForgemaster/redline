import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { requireServiceRunAccess } from "@/lib/api/service-access";
import { apiError, apiOk } from "@/lib/api/errors";
import { isValidIdempotencyKey } from "@/lib/policies/idempotency";

const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy_meters: z.number().finite().min(0).max(75),
  captured_at_device: z.iso.datetime({ offset: true }),
}).strict();

const startSchema = z.object({
  service_run_id: z.uuid(),
  location: locationSchema,
}).strict();
const finishSchema = z.object({ location: locationSchema }).strict();

export async function applyVisitLifecycle(
  request: Request,
  resourceId: string,
  action: "start" | "finish"
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!z.uuid().safeParse(resourceId).success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid work order or visit ID.");
  }
  const key = request.headers.get("Idempotency-Key");
  if (!isValidIdempotencyKey(key)) {
    return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A UUID v4 Idempotency-Key is required.");
  }
  const parsed = (action === "start" ? startSchema : finishSchema)
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "A visit ID and valid GPS fix are required; self-approved overrides are not accepted.");
  }

  const runId = action === "start" ? (parsed.data as z.infer<typeof startSchema>).service_run_id : resourceId;
  const workOrderId = action === "start" ? resourceId : null;
  let parentId = workOrderId;
  if (action === "finish") {
    const access = await requireServiceRunAccess(auth.supabase, auth.user.id, runId);
    if (!access.ok) return access.response;
    parentId = access.serviceRun.work_order_id;
  }
  const location = parsed.data.location;
  // The database function locks the visit, rechecks current assignment and
  // evidence, and commits state, GPS, event, alerts and idempotency together.
  const { data, error } = await auth.supabase.rpc("apply_visit_start_finish" as never, {
    p_run_id: runId,
    p_work_order_id: parentId,
    p_action: action,
    p_key: key,
    p_latitude: location.latitude,
    p_longitude: location.longitude,
    p_accuracy_meters: location.accuracy_meters,
    p_captured_at_device: location.captured_at_device,
  } as never);
  if (error) {
    if (error.code === "42501") return apiError(403, "FORBIDDEN", "Current visit access is required.");
    if (error.code === "P0002") return apiError(404, "NOT_FOUND", "Visit was not found.");
    if (error.code === "23505") return apiError(409, "CONFLICT_FINALIZED_RECORD", "Idempotency key was reused with changed input.");
    if (error.code === "40001") return apiError(409, "INVALID_STATE_TRANSITION", "Visit changed or needs reconciliation. Refresh before retrying.");
    if (error.code === "22023") return apiError(400, "LOCATION_REQUIRED", "A plausible GPS fix is required.");
    if (error.code === "23514") {
      if (error.message.includes("photos")) return apiError(409, "REQUIRED_PHOTOS_MISSING", error.message);
      if (error.message.includes("checklist")) return apiError(409, "TEMPLATE_INCOMPLETE", error.message);
      return apiError(409, "LOCATION_REQUIRED", error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Visit change was not confirmed. Keep the queued operation and retry.");
  }
  return apiOk(data, action === "start" ? 201 : 200);
}
