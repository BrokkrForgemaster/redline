import { requireStaffUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffUser("staff");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  const { data: run, error: runError } = await sb
    .from("service_runs")
    .select(
      `id, status, started_at, finished_at, submitted_at, reviewed_at, reviewed_by,
       approved_at, rejected_at, rejection_reason, version_number, created_at,
       work_orders(id, work_order_number, title, scheduled_start, instructions,
         customers(id, first_name, last_name, business_name),
         properties(id, address_line1, city, state, zip)
       ),
       profiles!service_runs_primary_worker_id_fkey(id, first_name, last_name)`
    )
    .eq("id", id)
    .single();

  if (runError || !run) {
    return apiError(404, "NOT_FOUND", "Service run was not found.");
  }

  const [mediaResult, notesResult, eventsResult, locationResult, reportResult] = await Promise.all([
    sb
      .from("media_assets")
      .select("id, evidence_type, media_category, status, mime_type, byte_size, created_at, object_key, bucket")
      .eq("service_run_id", id)
      .in("status", ["uploaded", "attached", "finalized"])
      .order("created_at", { ascending: true }),
    sb
      .from("service_notes")
      .select("id, note_type, body, created_at, profiles(first_name, last_name)")
      .eq("service_run_id", id)
      .order("created_at", { ascending: true }),
    sb
      .from("service_run_events")
      .select("id, event_type, from_status, to_status, metadata, created_at, profiles!service_run_events_actor_id_fkey(first_name, last_name)")
      .eq("service_run_id", id)
      .order("created_at", { ascending: true }),
    sb
      .from("location_events")
      .select("id, event_type, result, distance_meters, configured_radius_meters, accuracy_meters, override_reason, captured_at_device, received_at_server")
      .eq("service_run_id", id)
      .order("received_at_server", { ascending: true }),
    sb
      .from("report_versions")
      .select("id, version_number, bucket, object_key, generated_at")
      .eq("service_run_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Generate short-lived signed download URLs for each media asset
  const assets = mediaResult.data ?? [];
  const assetsWithUrls = await Promise.all(
    assets.map(async (asset: { bucket: string; object_key: string; [key: string]: unknown }) => {
      const { data: signed } = await sb.storage
        .from(asset.bucket)
        .createSignedUrl(asset.object_key, 900); // 15-minute expiry
      return { ...asset, signed_url: signed?.signedUrl ?? null };
    })
  );

  // Generate signed URL for the latest report PDF if one exists
  let reportUrl: string | null = null;
  if (reportResult.data) {
    const { data: signed } = await sb.storage
      .from(reportResult.data.bucket)
      .createSignedUrl(reportResult.data.object_key, 900);
    reportUrl = signed?.signedUrl ?? null;
  }

  return apiOk({
    service_run: run,
    assets: assetsWithUrls,
    notes: notesResult.data ?? [],
    events: eventsResult.data ?? [],
    location_events: locationResult.data ?? [],
    report: reportResult.data
      ? { ...reportResult.data, signed_url: reportUrl }
      : null,
    counts: {
      before: assetsWithUrls.filter((a: { evidence_type?: string }) => a.evidence_type === "before").length,
      after: assetsWithUrls.filter((a: { evidence_type?: string }) => a.evidence_type === "after").length,
    },
  });
}
