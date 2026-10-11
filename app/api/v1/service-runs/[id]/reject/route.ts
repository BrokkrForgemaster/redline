import { requireStaffUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { assertServiceStateTransition } from "@/lib/policies/service-state";
import type { ServiceState } from "@/lib/policies/service-state";

interface RejectBody {
  reason: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffUser("reviewer");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as RejectBody;

  if (!body.reason?.trim()) {
    return apiError(400, "VALIDATION_ERROR", "A rejection reason is required.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  const { data: run, error: runError } = await sb
    .from("service_runs")
    .select("id, status")
    .eq("id", id)
    .single();

  if (runError || !run) {
    return apiError(404, "NOT_FOUND", "Service run was not found.");
  }

  const transition = assertServiceStateTransition(run.status as ServiceState, "rejected");
  if (!transition.ok) {
    return apiError(409, "INVALID_STATE_TRANSITION", transition.message);
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await sb
    .from("service_runs")
    .update({
      status: "rejected",
      rejected_at: now,
      rejection_reason: body.reason.trim(),
      reviewed_at: now,
      reviewed_by: auth.user.id,
    })
    .eq("id", id)
    .select("id, status, rejected_at, rejection_reason")
    .single();

  if (updateError || !updated) {
    return apiError(500, "INTERNAL_ERROR", "Failed to reject service run.");
  }

  await sb.from("service_run_events").insert({
    service_run_id: id,
    event_type: "reject",
    actor_id: auth.user.id,
    from_status: run.status,
    to_status: "rejected",
    metadata: { reason: body.reason.trim() },
  });

  return apiOk({ service_run: updated });
}
