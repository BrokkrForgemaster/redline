import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_EMAILS, DEVELOPER_EMAILS } from "@/lib/auth/privileged-users";

type RunAlertEvent = "start" | "finish";

export async function notifyPrivilegedUsersOfRunEvent(params: {
  event: RunAlertEvent;
  serviceRunId: string;
  workOrderId: string;
  actorId: string;
}) {
  const admin = createAdminClient() as any;
  const recipientEmails = [...ADMIN_EMAILS, ...DEVELOPER_EMAILS];

  const [{ data: recipients }, { data: run }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email")
      .in("email", recipientEmails)
      .eq("status", "active"),
    admin
      .from("service_runs")
      .select(`
        id,
        work_orders(work_order_number, title),
        profiles!service_runs_primary_worker_id_fkey(first_name, last_name, email)
      `)
      .eq("id", params.serviceRunId)
      .single(),
  ]);

  const recipientIds = ((recipients ?? []) as { id: string }[]).map((recipient) => recipient.id);
  if (recipientIds.length === 0) return;

  const worker = run?.profiles
    ? `${run.profiles.first_name} ${run.profiles.last_name}`.trim()
    : "A subcontractor";
  const workOrder = run?.work_orders;
  const title = params.event === "start" ? "Job started" : "Job ended";
  const action = params.event === "start" ? "started" : "ended";
  const body = `${worker} ${action} ${workOrder?.work_order_number ?? "a work order"}${workOrder?.title ? `: ${workOrder.title}` : ""}.`;

  const { error } = await admin.from("notifications").insert(
    recipientIds.map((userId) => ({
      user_id: userId,
      type: `service_run_${params.event}`,
      title,
      body,
      action_url: `/service-runs/${params.serviceRunId}`,
      entity_type: "service_run",
      entity_id: params.serviceRunId,
    }))
  );

  if (error) {
    console.error("Failed to insert admin run notification", error);
  }
}
