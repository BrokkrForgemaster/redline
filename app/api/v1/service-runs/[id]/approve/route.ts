import { createHash } from "crypto";
import { requireStaffUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { assertServiceStateTransition } from "@/lib/policies/service-state";
import type { ServiceState } from "@/lib/policies/service-state";
import { createAdminClient } from "@/lib/supabase/server";
import { renderServiceRunPdf } from "@/lib/reports/serviceRunPdf";

const REPORT_BUCKET = "service-reports";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffUser("reviewer");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  const { data: run, error: runError } = await sb
    .from("service_runs")
    .select(`
      id, status, version_number, started_at, finished_at, submitted_at,
      work_orders(
        id, work_order_number, title, instructions,
        customers(first_name, last_name, business_name),
        properties(address_line1, city, state, zip)
      ),
      profiles!service_runs_primary_worker_id_fkey(first_name, last_name)
    `)
    .eq("id", id)
    .single();

  if (runError || !run) {
    return apiError(404, "NOT_FOUND", "Service run was not found.");
  }

  const transition = assertServiceStateTransition(run.status as ServiceState, "completed");
  if (!transition.ok) {
    return apiError(409, "INVALID_STATE_TRANSITION", transition.message);
  }

  const now = new Date().toISOString();

  // Approve the run
  const { data: updated, error: updateError } = await sb
    .from("service_runs")
    .update({
      status: "completed",
      approved_at: now,
      reviewed_at: now,
      reviewed_by: auth.user.id,
      frozen_at: now,
    })
    .eq("id", id)
    .select("id, status, approved_at")
    .single();

  if (updateError || !updated) {
    return apiError(500, "INTERNAL_ERROR", "Failed to approve service run.");
  }

  await sb.from("service_run_events").insert({
    service_run_id: id,
    event_type: "approve",
    actor_id: auth.user.id,
    from_status: run.status,
    to_status: "completed",
    metadata: {},
  });

  // Fetch supporting data for the PDF
  const [mediaResult, notesResult, locationResult, approverResult] = await Promise.all([
    sb
      .from("media_assets")
      .select("evidence_type")
      .eq("service_run_id", id)
      .in("status", ["uploaded", "attached", "finalized"]),
    sb
      .from("service_notes")
      .select("body, note_type, created_at, profiles(first_name, last_name)")
      .eq("service_run_id", id)
      .order("created_at", { ascending: true }),
    sb
      .from("location_events")
      .select("event_type, result, distance_meters, configured_radius_meters, accuracy_meters, override_reason, captured_at_device")
      .eq("service_run_id", id)
      .order("received_at_server", { ascending: true }),
    sb
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", auth.user.id)
      .single(),
  ]);

  const assets: { evidence_type: string | null }[] = mediaResult.data ?? [];
  const beforeCount = assets.filter((a) => a.evidence_type === "before").length;
  const afterCount = assets.filter((a) => a.evidence_type === "after").length;

  const wo = run.work_orders;
  const customer = wo?.customers?.business_name
    ?? (wo?.customers ? `${wo.customers.first_name} ${wo.customers.last_name}` : "Unknown");
  const address = wo?.properties
    ? `${wo.properties.address_line1}, ${wo.properties.city}, ${wo.properties.state} ${wo.properties.zip}`
    : "Unknown";
  const workerName = run.profiles
    ? `${run.profiles.first_name} ${run.profiles.last_name}`
    : "Unknown";
  const approverName = approverResult.data
    ? `${approverResult.data.first_name} ${approverResult.data.last_name}`
    : "Staff";

  // Determine the next report version number
  const { data: latestReport } = await sb
    .from("report_versions")
    .select("version_number")
    .eq("service_run_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latestReport?.version_number ?? 0) + 1;
  const objectKey = `service-runs/${id}/report-v${nextVersion}.pdf`;

  // Generate PDF
  let pdfUrl: string | null = null;
  try {
    const pdfBuffer = await renderServiceRunPdf({
      workOrderNumber: wo?.work_order_number ?? id.slice(0, 8),
      title: wo?.title ?? "Service Run",
      customerName: customer,
      address,
      workerName,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      submittedAt: run.submitted_at,
      approvedAt: now,
      approvedByName: approverName,
      instructions: wo?.instructions ?? null,
      beforeCount,
      afterCount,
      locationEvents: locationResult.data ?? [],
      notes: (notesResult.data ?? []).map((n: { body: string; note_type: string; created_at: string; profiles: { first_name: string; last_name: string } | null }) => ({
        body: n.body,
        note_type: n.note_type,
        authorName: n.profiles ? `${n.profiles.first_name} ${n.profiles.last_name}` : "Field worker",
        created_at: n.created_at,
      })),
      serviceRunId: id,
      generatedAt: now,
    });

    const sha256Hex = createHash("sha256").update(pdfBuffer).digest("hex");

    // Upload using the service role client so it bypasses RLS on storage
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: uploadError } = await (admin.storage as any)
      .from(REPORT_BUCKET)
      .upload(objectKey, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (!uploadError) {
      await sb.from("report_versions").insert({
        service_run_id: id,
        version_number: nextVersion,
        source_version: run.version_number,
        generated_by: auth.user.id,
        generated_by_process: "approve_endpoint",
        bucket: REPORT_BUCKET,
        object_key: objectKey,
        sha256_hex: sha256Hex,
      });

      const { data: signed } = await admin.storage
        .from(REPORT_BUCKET)
        .createSignedUrl(objectKey, 900);
      pdfUrl = signed?.signedUrl ?? null;
    }
  } catch {
    // PDF generation is best-effort; the approval itself has already succeeded
  }

  return apiOk({ service_run: updated, report_url: pdfUrl });
}
