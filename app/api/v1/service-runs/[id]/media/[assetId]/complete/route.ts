import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { requireServiceRunAccess } from "@/lib/api/service-access";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyStoredImage } from "@/lib/media/verify-image";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id, assetId } = await params;
  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;

  await request.json().catch(() => ({})); // Client metadata never verifies stored evidence.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;

  const { data: asset, error } = await sb
    .from("media_assets")
    .select("id, status, service_run_id, uploaded_by, bucket, object_key, mime_type")
    .eq("id", assetId)
    .eq("service_run_id", id)
    .single();

  if (error || !asset) {
    return apiError(404, "NOT_FOUND", "Media asset not found.");
  }
  if (asset.uploaded_by !== auth.user.id || asset.bucket !== "service-evidence" ||
      !asset.object_key?.startsWith(`service-runs/${id}/`)) {
    return apiError(403, "FORBIDDEN", "Media does not belong to this worker and visit.");
  }
  if (asset.status !== "pending_upload" && asset.status !== "attached") {
    return apiError(409, "CONFLICT_FINALIZED_RECORD", "Asset is finalized or unavailable.");
  }
  if (asset.status === "pending_upload" && ["submitted", "completed", "cancelled"].includes(access.serviceRun.status)) {
    return apiError(409, "CONFLICT_FINALIZED_RECORD", "Visit is finalized; request an audited amendment.");
  }

  const { data: object, error: storageError } = await sb.storage
    .from(asset.bucket).download(asset.object_key);
  if (storageError || !object) return apiError(409, "VALIDATION_ERROR", "Stored image is missing; retry the upload.");
  const bytes = Buffer.from(await object.arrayBuffer());
  let verified;
  try {
    verified = await verifyStoredImage(bytes, asset.mime_type);
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Stored image is corrupt, unsupported, or does not match its declared type.");
  }
  const { data: result, error: attachError } = await sb.rpc("attach_verified_visit_media", {
    p_actor_id: auth.user.id,
    p_run_id: id,
    p_asset_id: assetId,
    p_byte_size: verified.byteSize,
    p_sha256_hex: verified.sha256Hex,
    p_width: verified.width,
    p_height: verified.height,
  });
  if (attachError) {
    if (attachError.code === "42501") return apiError(403, "FORBIDDEN", "Current media access is required.");
    if (attachError.code === "P0002") return apiError(404, "NOT_FOUND", "Visit or asset was not found.");
    if (attachError.code === "23505" || attachError.code === "40001") {
      return apiError(409, "CONFLICT_FINALIZED_RECORD", "Media changed or the visit was finalized. Reconcile before retrying.");
    }
    return apiError(500, "INTERNAL_ERROR", "Media attachment was not confirmed. Keep the local photo.");
  }
  return apiOk(result);
}
