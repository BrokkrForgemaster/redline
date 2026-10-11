import { requireApiUser } from "@/lib/api/auth";
import { requireServiceRunAccess } from "@/lib/api/service-access";
import { beginIdempotentRequest, completeIdempotentRequest } from "@/lib/api/idempotency";
import { apiError, apiOk } from "@/lib/api/errors";

interface ChecklistResponseItem {
  checklist_item_id: string;
  completed: boolean;
  response_value?: Record<string, unknown>;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;

  const { serviceRun } = access;
  if (!["in_progress", "paused"].includes(serviceRun.status)) {
    return apiError(422, "INVALID_STATE_TRANSITION", `Cannot save checklist for a run in state ${serviceRun.status}.`);
  }

  const idempotencyKey = req.headers.get("Idempotency-Key");
  const body = await req.json().catch(() => ({}));

  const idem = await beginIdempotentRequest(auth.supabase, auth.user.id, `service-runs:${id}:checklist`, idempotencyKey, body);
  if (!idem.ok) return idem.response;

  const responses: ChecklistResponseItem[] = Array.isArray(body.responses) ? body.responses : [];
  if (!responses.length) {
    return apiError(400, "VALIDATION_ERROR", "responses array is required and must not be empty.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;
  const now = new Date().toISOString();

  const rows = responses.map((r) => ({
    service_run_id: id,
    checklist_item_id: r.checklist_item_id,
    completed: r.completed ?? false,
    response_value: r.response_value ?? {},
    completed_by: r.completed ? auth.user.id : null,
    completed_at: r.completed ? now : null,
    updated_at: now,
  }));

  const { error } = await sb
    .from("checklist_responses")
    .upsert(rows, { onConflict: "service_run_id,checklist_item_id" });

  if (error) return apiError(500, "INTERNAL_ERROR", error.message);

  const result = { saved: rows.length };
  await completeIdempotentRequest(auth.supabase, idem.id, 200, result);
  return apiOk(result);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  const { data: responses, error } = await sb
    .from("checklist_responses")
    .select("checklist_item_id, completed, response_value, completed_at")
    .eq("service_run_id", id);

  if (error) return apiError(500, "INTERNAL_ERROR", error.message);

  // Keyed by checklist_item_id for easy lookup on the client
  const byItemId: Record<string, { completed: boolean; response_value: Record<string, unknown>; completed_at: string | null }> = {};
  for (const r of responses ?? []) {
    byItemId[r.checklist_item_id] = {
      completed: r.completed,
      response_value: r.response_value ?? {},
      completed_at: r.completed_at,
    };
  }

  return apiOk({ responses: byItemId });
}
