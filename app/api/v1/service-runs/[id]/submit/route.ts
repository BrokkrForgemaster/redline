import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { beginIdempotentRequest, completeIdempotentRequest } from "@/lib/api/idempotency";
import { requireServiceRunAccess } from "@/lib/api/service-access";
import { assertServiceStateTransition, type ServiceState } from "@/lib/policies/service-state";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const idempotency = await beginIdempotentRequest(
    auth.supabase,
    auth.user.id,
    `service-runs:${id}:submit`,
    request.headers.get("Idempotency-Key"),
    body
  );
  if (!idempotency.ok) return idempotency.response;

  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;
  if (!access.serviceRun.finished_at) {
    return apiError(409, "INVALID_STATE_TRANSITION", "Finish the service run before submitting it.");
  }

  const transition = assertServiceStateTransition(access.serviceRun.status as ServiceState, "submitted");
  if (!transition.ok) return apiError(409, "INVALID_STATE_TRANSITION", transition.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;
  const submittedAt = new Date().toISOString();
  const { data: updated, error } = await sb
    .from("service_runs")
    .update({ status: "submitted", submitted_at: submittedAt })
    .eq("id", id)
    .select("id, status, submitted_at")
    .single();

  if (error || !updated) return apiError(500, "INTERNAL_ERROR", "Failed to submit service run.");

  await sb.from("work_orders").update({ status: "submitted" }).eq("id", access.serviceRun.work_order_id);
  await sb.from("service_run_events").insert({
    service_run_id: id,
    event_type: "submit",
    actor_id: auth.user.id,
    from_status: access.serviceRun.status,
    to_status: "submitted",
    metadata: {},
  });

  const responseBody = { service_run: updated };
  await completeIdempotentRequest(auth.supabase, idempotency.id, 200, responseBody);
  return apiOk(responseBody);
}
