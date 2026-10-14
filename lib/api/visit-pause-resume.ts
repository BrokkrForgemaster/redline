import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { isValidIdempotencyKey } from "@/lib/policies/idempotency";

const commandSchema = z.object({ reason: z.string().trim().max(500).optional() }).strict();

export async function applyPauseResume(
  request: Request,
  runId: string,
  action: "pause" | "resume"
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!z.uuid().safeParse(runId).success) return apiError(400, "VALIDATION_ERROR", "Invalid visit ID.");

  const key = request.headers.get("Idempotency-Key");
  if (!isValidIdempotencyKey(key)) {
    return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A UUID v4 Idempotency-Key is required.");
  }
  const body = commandSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "VALIDATION_ERROR", "Invalid visit command.");

  // The database function rechecks active role and assignment after locking
  // the run, then commits state, event, audit and idempotency in one transaction.
  const { data, error } = await auth.supabase.rpc("apply_visit_pause_resume" as never, {
    p_run_id: runId,
    p_action: action,
    p_key: key,
    p_reason: body.data.reason ?? null,
  } as never);
  if (error) {
    if (error.code === "42501") return apiError(403, "FORBIDDEN", "Current visit access is required.");
    if (error.code === "P0002") return apiError(404, "NOT_FOUND", "Visit was not found.");
    if (error.code === "23505") return apiError(409, "CONFLICT_FINALIZED_RECORD", "Idempotency key was reused with changed input.");
    if (error.code === "40001") return apiError(409, "INVALID_STATE_TRANSITION", "Visit changed or needs reconciliation. Refresh before retrying.");
    if (error.code === "22023") return apiError(400, "VALIDATION_ERROR", "Invalid visit command.");
    return apiError(500, "INTERNAL_ERROR", "Visit change was not confirmed. Keep the queued operation.");
  }
  return apiOk(data);
}
