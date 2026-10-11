import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { requireServiceRunAccess } from "@/lib/api/service-access";

interface CompleteBody {
  byte_size?: number;
  width?: number;
  height?: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id, assetId } = await params;
  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as CompleteBody;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  const { data: asset, error } = await sb
    .from("media_assets")
    .select("id, status, service_run_id")
    .eq("id", assetId)
    .eq("service_run_id", id)
    .single();

  if (error || !asset) {
    return apiError(404, "NOT_FOUND", "Media asset not found.");
  }
  if (asset.status !== "pending_upload") {
    return apiError(409, "CONFLICT_FINALIZED_RECORD", "Asset is already completed or finalized.");
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await sb
    .from("media_assets")
    .update({
      status: "attached",
      uploaded_at: now,
      ...(body.byte_size != null ? { byte_size: body.byte_size } : {}),
      ...(body.width != null ? { width: body.width } : {}),
      ...(body.height != null ? { height: body.height } : {}),
    })
    .eq("id", assetId)
    .select("id, status, uploaded_at, evidence_type, media_category")
    .single();

  if (updateError || !updated) {
    return apiError(500, "INTERNAL_ERROR", "Failed to complete media record.");
  }

  return apiOk({ asset: updated });
}
