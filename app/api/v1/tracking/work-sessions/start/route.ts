import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { beginIdempotentRequest, completeIdempotentRequest } from "@/lib/api/idempotency";

interface StartWorkSessionBody {
  device_id?: string;
  clock_in_source?: "manual" | "scheduled" | "admin";
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as StartWorkSessionBody;
  const idempotency = await beginIdempotentRequest(
    auth.supabase,
    auth.user.id,
    "tracking:work-sessions:start",
    request.headers.get("Idempotency-Key"),
    body
  );
  if (!idempotency.ok) return idempotency.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;
  const { data: existing } = await sb
    .from("employee_work_sessions")
    .select("id, started_at, tracking_required, tracking_started_at")
    .eq("employee_id", auth.user.id)
    .is("stopped_at", null)
    .maybeSingle();

  if (existing) {
    const responseBody = { work_session: existing, already_open: true };
    await completeIdempotentRequest(auth.supabase, idempotency.id, 200, responseBody);
    return apiOk(responseBody);
  }

  const now = new Date().toISOString();
  const { data: session, error } = await sb
    .from("employee_work_sessions")
    .insert({
      employee_id: auth.user.id,
      device_id: body.device_id ?? null,
      clock_in_source: body.clock_in_source ?? "manual",
      started_at: now,
      tracking_required: true,
      tracking_started_at: now,
    })
    .select("id, started_at, tracking_required, tracking_started_at")
    .single();

  if (error || !session) return apiError(500, "INTERNAL_ERROR", "Failed to start work session.");

  await sb.from("tracking_health_events").insert({
    employee_id: auth.user.id,
    work_session_id: session.id,
    device_id: body.device_id ?? null,
    event_type: "tracking_started",
    severity: "info",
    details: {},
  });

  const responseBody = { work_session: session, already_open: false };
  await completeIdempotentRequest(auth.supabase, idempotency.id, 201, responseBody);
  return apiOk(responseBody, 201);
}
