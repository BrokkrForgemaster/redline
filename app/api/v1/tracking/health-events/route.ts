import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { beginIdempotentRequest, completeIdempotentRequest } from "@/lib/api/idempotency";

interface HealthEventBody {
  work_session_id?: string;
  device_id?: string;
  event_type?: string;
  severity?: "info" | "warning" | "critical";
  details?: Record<string, unknown>;
  captured_at_device?: string;
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as HealthEventBody;
  const idempotency = await beginIdempotentRequest(
    auth.supabase,
    auth.user.id,
    "tracking:health-events",
    request.headers.get("Idempotency-Key"),
    body
  );
  if (!idempotency.ok) return idempotency.response;

  if (!body.event_type) {
    return apiError(400, "VALIDATION_ERROR", "event_type is required.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;
  const { data, error } = await sb
    .from("tracking_health_events")
    .insert({
      employee_id: auth.user.id,
      work_session_id: body.work_session_id ?? null,
      device_id: body.device_id ?? null,
      event_type: body.event_type,
      severity: body.severity ?? "info",
      details: body.details ?? {},
      captured_at_device: body.captured_at_device ?? null,
    })
    .select("id, event_type, severity, received_at_server")
    .single();

  if (error || !data) return apiError(500, "INTERNAL_ERROR", "Failed to record tracking health event.");

  const responseBody = { health_event: data };
  await completeIdempotentRequest(auth.supabase, idempotency.id, 201, responseBody);
  return apiOk(responseBody, 201);
}
