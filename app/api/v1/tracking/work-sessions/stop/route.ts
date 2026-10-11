import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { beginIdempotentRequest, completeIdempotentRequest } from "@/lib/api/idempotency";

interface StopWorkSessionBody {
  work_session_id?: string;
  device_id?: string;
  stop_reason?: string;
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as StopWorkSessionBody;
  const idempotency = await beginIdempotentRequest(
    auth.supabase,
    auth.user.id,
    "tracking:work-sessions:stop",
    request.headers.get("Idempotency-Key"),
    body
  );
  if (!idempotency.ok) return idempotency.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;
  let query = sb
    .from("employee_work_sessions")
    .select("id")
    .eq("employee_id", auth.user.id)
    .is("stopped_at", null);

  if (body.work_session_id) query = query.eq("id", body.work_session_id);

  const { data: session } = await query.maybeSingle();
  if (!session) {
    const responseBody = { work_session: null, already_stopped: true };
    await completeIdempotentRequest(auth.supabase, idempotency.id, 200, responseBody);
    return apiOk(responseBody);
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await sb
    .from("employee_work_sessions")
    .update({
      stopped_at: now,
      tracking_stopped_at: now,
      stop_reason: body.stop_reason ?? "manual",
    })
    .eq("id", session.id)
    .eq("employee_id", auth.user.id)
    .select("id, started_at, stopped_at, tracking_stopped_at, stop_reason")
    .single();

  if (error || !updated) return apiError(500, "INTERNAL_ERROR", "Failed to stop work session.");

  await sb.from("tracking_health_events").insert({
    employee_id: auth.user.id,
    work_session_id: session.id,
    device_id: body.device_id ?? null,
    event_type: "tracking_stopped",
    severity: "info",
    details: { stop_reason: body.stop_reason ?? "manual" },
  });

  const responseBody = { work_session: updated, already_stopped: false };
  await completeIdempotentRequest(auth.supabase, idempotency.id, 200, responseBody);
  return apiOk(responseBody);
}
