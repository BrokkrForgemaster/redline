import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";
import { isAllowedPushEndpoint } from "./endpoint";

type Job = { id: string; recipient_id: string; source_event_id: string; lease_token: string };
type Subscription = { id: string; endpoint: string; p256dh: string; auth_secret: string };

async function recipientCanStillSeeEvent(sb: ReturnType<typeof createAdminClient>, job: Job) {
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("role, status").eq("id", job.recipient_id).single();
  if (profileError || profile?.status !== "active") return { allowed: false, runId: null };
  const { data: event, error: eventError } = await sb.from("service_run_events")
    .select("service_run_id").eq("id", job.source_event_id).single();
  if (eventError || !event) return { allowed: false, runId: null };
  const { data: run, error: runError } = await sb.from("service_runs")
    .select("work_order_id").eq("id", event.service_run_id).single();
  if (runError || !run) return { allowed: false, runId: null };
  if (profile.role === "owner") return { allowed: true, runId: event.service_run_id };

  const { data: assignments, error: assignmentError } = await sb.from("work_order_assignments")
    .select("assignment_type, crew_id, subcontractor_company_id")
    .eq("work_order_id", run.work_order_id).eq("active", true);
  if (assignmentError) throw new Error("Recipient assignments unavailable.");
  const crewIds = ((assignments ?? []) as { assignment_type: string; crew_id: string | null }[])
    .filter(row => row.assignment_type === "crew" && row.crew_id).map(row => row.crew_id!);
  if (crewIds.length) {
    const { data: leads, error } = await sb.from("crews").select("id")
      .in("id", crewIds).eq("leader_id", job.recipient_id).eq("active", true).limit(1);
    if (error) throw new Error("Recipient crew unavailable.");
    if (leads?.length) return { allowed: true, runId: event.service_run_id };
  }
  const companyIds = ((assignments ?? []) as { assignment_type: string; subcontractor_company_id: string | null }[])
    .filter(row => row.assignment_type === "subcontractor" && row.subcontractor_company_id)
    .map(row => row.subcontractor_company_id!);
  if (companyIds.length) {
    const { data: supervisors, error } = await sb.from("subcontractor_memberships")
      .select("id, subcontractor_companies!inner(status)")
      .in("subcontractor_company_id", companyIds).eq("user_id", job.recipient_id)
      .eq("active", true).in("role", ["owner", "manager"])
      .eq("subcontractor_companies.status", "active").limit(1);
    if (error) throw new Error("Recipient company unavailable.");
    if (supervisors?.length) return { allowed: true, runId: event.service_run_id };
  }
  return { allowed: false, runId: null };
}

async function finishJob(sb: ReturnType<typeof createAdminClient>, job: Job,
  state: "delivered" | "retry" | "disabled" | "failed", errorClass?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("finish_workflow_push_job", {
    p_id: job.id, p_lease_token: job.lease_token, p_state: state,
    p_error_class: errorClass ?? null,
  });
  if (error || data !== true) throw new Error("Push lease could not be completed.");
}

export async function deliverWorkflowPushBatch(): Promise<{ claimed: number; accepted: number; retry: number }> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject?.startsWith("mailto:")) {
    throw new Error("VAPID delivery is not configured.");
  }
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("claim_workflow_push_jobs", { p_limit: 20 });
  if (error) throw new Error("Could not claim push jobs.");
  const jobs = (data ?? []) as Job[];
  let accepted = 0;
  let retry = 0;

  for (const job of jobs) {
    try {
      const access = await recipientCanStillSeeEvent(sb, job);
      if (!access.allowed || !access.runId) {
        await finishJob(sb, job, "disabled", "scope_revoked");
        continue;
      }
      const { data: preference, error: preferenceError } = await sb.from("push_preferences")
        .select("push_enabled").eq("user_id", job.recipient_id).maybeSingle();
      if (preferenceError) throw new Error("Preference unavailable.");
      if (!preference?.push_enabled) {
        await finishJob(sb, job, "disabled", "push_disabled");
        continue;
      }
      const { data: inbox, error: inboxError } = await sb.from("notifications")
        .select("id").eq("source_event_id", job.source_event_id)
        .eq("user_id", job.recipient_id).maybeSingle();
      if (inboxError || !inbox) throw new Error("Inbox event unavailable.");
      const { data: subscriptions, error: subscriptionError } = await sb.from("push_subscriptions")
        .select("id, endpoint, p256dh, auth_secret")
        .eq("user_id", job.recipient_id).eq("enabled", true).limit(10);
      if (subscriptionError) throw new Error("Subscriptions unavailable.");
      if (!subscriptions?.length) {
        await finishJob(sb, job, "disabled", "no_subscription");
        continue;
      }
      const { data: prior, error: priorError } = await sb.from("workflow_push_attempts")
        .select("subscription_id, state").eq("outbox_id", job.id);
      if (priorError) throw new Error("Delivery history unavailable.");
      const acceptedIds = new Set(((prior ?? []) as { subscription_id: string; state: string }[])
        .filter(row => row.state === "accepted").map(row => row.subscription_id));
      let anyAccepted = acceptedIds.size > 0;
      let needsRetry = false;
      for (const subscription of subscriptions as Subscription[]) {
        if (acceptedIds.has(subscription.id)) continue;
        if (!isAllowedPushEndpoint(subscription.endpoint)) {
          const { error: invalidError } = await sb.from("push_subscriptions")
            .update({ enabled: false }).eq("id", subscription.id).eq("user_id", job.recipient_id);
          if (invalidError) throw new Error("Invalid endpoint could not be disabled.");
          continue;
        }
        let attemptState: "accepted" | "expired" | "retry" = "retry";
        let errorClass: string | null = null;
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
          }, JSON.stringify({ url: `/service-runs/${access.runId}`, eventId: inbox.id }), {
            vapidDetails: { subject, publicKey, privateKey }, TTL: 3600, timeout: 10000,
          });
          attemptState = "accepted";
          anyAccepted = true;
        } catch (cause) {
          const code = typeof cause === "object" && cause !== null && "statusCode" in cause
            ? Number(cause.statusCode) : 0;
          errorClass = code ? `provider_${code}` : "network";
          if ([400, 404, 410, 413].includes(code)) {
            attemptState = "expired";
            const { error: disableError } = await sb.from("push_subscriptions")
              .update({ enabled: false }).eq("id", subscription.id).eq("user_id", job.recipient_id);
            if (disableError) throw new Error("Expired endpoint could not be disabled.");
          } else needsRetry = true;
        }
        const { error: recordError } = await sb.from("workflow_push_attempts")
          .upsert({ outbox_id: job.id, subscription_id: subscription.id,
            state: attemptState, last_error_class: errorClass, updated_at: new Date().toISOString() },
          { onConflict: "outbox_id,subscription_id" });
        if (recordError) throw new Error("Push attempt could not be recorded.");
      }
      if (needsRetry) { await finishJob(sb, job, "retry", "transient_provider"); retry++; }
      else if (anyAccepted) { await finishJob(sb, job, "delivered"); accepted++; }
      else await finishJob(sb, job, "disabled", "no_valid_subscription");
    } catch {
      try { await finishJob(sb, job, "retry", "worker_error"); retry++; }
      catch { /* Lease expiry makes this job claimable again. */ }
    }
  }
  return { claimed: jobs.length, accepted, retry };
}
