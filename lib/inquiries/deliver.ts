import { createAdminClient } from "@/lib/supabase/server";

type Job = { id: string; lead_id: string; lease_token: string };

export function validatedInquiryDeliveryUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "formsubmit.co" &&
      !url.port && !url.username && !url.password && !url.hash &&
      /^\/ajax\/[A-Za-z0-9]+$/.test(url.pathname) ? url.toString() : null;
  } catch { return null; }
}

export async function deliverInquiryBatch(): Promise<{ claimed: number; accepted: number; retry: number }> {
  const endpoint = validatedInquiryDeliveryUrl(process.env.INQUIRY_DELIVERY_ENDPOINT);
  if (!endpoint) throw new Error("Inquiry delivery endpoint is not configured.");
  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("claim_inquiry_delivery_jobs", { p_limit: 20 });
  if (error) throw new Error("Could not claim inquiry jobs.");
  const jobs = (data ?? []) as Job[];
  let accepted = 0;
  let retry = 0;
  for (const job of jobs) {
    async function finish(state: "accepted" | "retry" | "failed" | "disabled", errorClass?: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (sb as any).rpc("finish_inquiry_delivery_job", {
        p_id: job.id, p_lease_token: job.lease_token,
        p_state: state, p_error_class: errorClass ?? null,
      });
      if (result.error || result.data !== true) throw new Error("Inquiry lease could not be completed.");
    }
    try {
      const { data: lead, error: leadError } = await sb.from("leads")
        .select("id, source, first_name, last_name, email, phone, requested_services, notes, public_submission_id")
        .eq("id", job.lead_id).single();
      if (leadError || !lead || lead.source !== "website_quote" || !lead.email || !lead.public_submission_id) {
        await finish("disabled", "invalid_inquiry");
        continue;
      }
      const response = await fetch(endpoint, {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: `${lead.first_name} ${lead.last_name === "-" ? "" : lead.last_name}`.trim(),
          email: lead.email, phone: lead.phone || "Not provided",
          service: lead.requested_services?.join(", ") || "Not specified",
          message: lead.notes,
          submission_id: lead.public_submission_id,
          _subject: `Redline quote inquiry ${lead.public_submission_id}`,
          _replyto: lead.email,
          _template: "table",
        }),
      });
      if (!response.ok) {
        const transient = response.status === 429 || response.status >= 500;
        await finish(transient ? "retry" : "failed", `provider_${response.status}`);
        if (transient) retry++;
        continue;
      }
      const result = await response.json().catch(() => null) as { success?: boolean | string } | null;
      if (result?.success !== true && result?.success !== "true") {
        await finish("retry", "ambiguous_provider_response");
        retry++;
        continue;
      }
      await finish("accepted");
      accepted++;
    } catch {
      try { await finish("retry", "network_or_worker_error"); retry++; }
      catch { /* Expired lease becomes claimable again. */ }
    }
  }
  return { claimed: jobs.length, accepted, retry };
}
