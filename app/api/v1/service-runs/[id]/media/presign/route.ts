import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { requireServiceRunAccess } from "@/lib/api/service-access";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_BYTE_SIZE = 20 * 1024 * 1024; // 20 MB
const BUCKET = "service-evidence";

interface PresignBody {
  mime_type: string;
  byte_size: number;
  evidence_type?: string;
  media_category?: string;
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return map[mime] ?? "bin";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;

  if (["submitted", "completed", "cancelled"].includes(access.serviceRun.status)) {
    return apiError(409, "CONFLICT_FINALIZED_RECORD", "Cannot add media to a finalized service run.");
  }

  const body = (await request.json().catch(() => ({}))) as PresignBody;

  if (!body.mime_type || !ALLOWED_MIME_TYPES.includes(body.mime_type)) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`
    );
  }
  if (!body.byte_size || body.byte_size <= 0 || body.byte_size > MAX_BYTE_SIZE) {
    return apiError(400, "VALIDATION_ERROR", "File size must be between 1 byte and 20 MB.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;
  const objectKey = `service-runs/${id}/${crypto.randomUUID()}.${mimeToExt(body.mime_type)}`;

  const { data: asset, error: assetError } = await sb
    .from("media_assets")
    .insert({
      service_run_id: id,
      work_order_id: access.serviceRun.work_order_id,
      uploaded_by: auth.user.id,
      bucket: BUCKET,
      object_key: objectKey,
      mime_type: body.mime_type,
      byte_size: body.byte_size,
      evidence_type: body.evidence_type ?? null,
      media_category: body.media_category ?? "routine_evidence",
      status: "pending_upload",
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    return apiError(500, "INTERNAL_ERROR", "Failed to create media record.");
  }

  const { data: signed, error: signError } = await sb.storage
    .from(BUCKET)
    .createSignedUploadUrl(objectKey, { upsert: false });

  if (signError || !signed) {
    await sb.from("media_assets").delete().eq("id", asset.id);
    return apiError(
      500,
      "INTERNAL_ERROR",
      "Failed to create upload URL. Ensure migration 011_service_storage_buckets.sql has been applied."
    );
  }

  return apiOk(
    {
      asset_id: asset.id,
      bucket: BUCKET,
      path: (signed as { path: string }).path,
      token: (signed as { token: string }).token,
    },
    201
  );
}
