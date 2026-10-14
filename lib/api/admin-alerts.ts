import { createAdminClient } from "@/lib/supabase/server";

type RunAlertEvent = "start" | "finish";

export async function notifyPrivilegedUsersOfRunEvent(params: {
  event: RunAlertEvent;
  serviceRunId: string;
  workOrderId: string;
  actorId: string;
}) {
  const admin = createAdminClient();

  const { data: recipients, error: recipientError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "owner")
    .eq("status", "active");
  if (recipientError) throw new Error("Could not resolve owner alert recipients.");

  const recipientIds = ((recipients ?? []) as { id: string }[]).map((recipient) => recipient.id);
  if (recipientIds.length === 0) return;

  const title = params.event === "start" ? "Job started" : "Job ended";
  const body = params.event === "start" ? "An assigned service visit started." : "An assigned service visit finished.";

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
