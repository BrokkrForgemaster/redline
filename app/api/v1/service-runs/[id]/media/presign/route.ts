import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { requireServiceRunAccess } from "@/lib/api/service-access";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

const MAX_BYTE_SIZE = 20 * 1024 * 1024; // 20 MB
const BUCKET = "service-evidence";

const presignSchema = z.object({
  asset_id: z.uuid().optional(),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  byte_size: z.number().int().positive().max(MAX_BYTE_SIZE),
  evidence_type: z.enum(["before", "after"]),
  media_category: z.literal("routine_evidence").optional(),
}).strict();

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

  const parsed = presignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "An allowed image, size and evidence type are required.");
  const body = parsed.data;
  const canAddEvidence = ["ready", "in_progress", "paused"].includes(access.serviceRun.status);
  if (body.evidence_type === "after" && !access.serviceRun.started_at) {
    return apiError(409, "INVALID_STATE_TRANSITION", "After photos require a started visit.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  if (!canAddEvidence) {
    if (body.asset_id) {
      const { data: attached } = await sb.from("media_assets")
        .select("id, status, uploaded_by, service_run_id, mime_type, evidence_type, byte_size")
        .eq("id", body.asset_id).eq("service_run_id", id).maybeSingle();
      if (attached?.status === "attached" && attached.uploaded_by === auth.user.id &&
          attached.mime_type === body.mime_type && attached.evidence_type === body.evidence_type &&
          attached.byte_size === body.byte_size) {
        return apiOk({ asset_id: attached.id, status: "attached" });
      }
    }
    return apiError(409, "CONFLICT_FINALIZED_RECORD", "Cannot add media to a finalized visit; request an audited amendment.");
  }
  const assetId = body.asset_id ?? crypto.randomUUID();
  const objectKey = `service-runs/${id}/${assetId}.${mimeToExt(body.mime_type)}`;

  const { data: inserted, error: assetError } = await sb
    .from("media_assets")
    .insert({
      id: assetId,
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
    .select("id, status, bucket, object_key, uploaded_by, service_run_id, mime_type, byte_size, evidence_type, media_category")
    .maybeSingle();

  if (assetError && assetError.code !== "23505") {
    return apiError(500, "INTERNAL_ERROR", "Failed to create media record.");
  }
  const { data: existing, error: existingError } = inserted ? { data: inserted, error: null } :
    await sb.from("media_assets")
      .select("id, status, bucket, object_key, uploaded_by, service_run_id, mime_type, byte_size, evidence_type, media_category")
      .eq("id", assetId).maybeSingle();
  if (existingError || !existing || existing.uploaded_by !== auth.user.id ||
      existing.service_run_id !== id || existing.bucket !== BUCKET ||
      existing.object_key !== objectKey || existing.mime_type !== body.mime_type ||
      existing.evidence_type !== body.evidence_type ||
      existing.media_category !== "routine_evidence") {
    return apiError(409, "CONFLICT_FINALIZED_RECORD", "Photo ID is already in use for different evidence.");
  }
  if (existing.status === "attached") return apiOk({ asset_id: assetId, status: "attached" });
  if (existing.status !== "pending_upload" || existing.byte_size !== body.byte_size) {
    return apiError(409, "CONFLICT_FINALIZED_RECORD", "Photo record changed; reconcile before retrying.");
  }

  const { data: signed, error: signError } = await sb.storage
    .from(BUCKET)
    .createSignedUploadUrl(objectKey, { upsert: false });

  if (signError || !signed) {
    return apiError(
      500,
      "INTERNAL_ERROR",
      "Failed to create upload URL. Ensure migration 011_service_storage_buckets.sql has been applied."
    );
  }

  return apiOk(
    {
      asset_id: assetId,
      status: "pending_upload",
      bucket: BUCKET,
      path: (signed as { path: string }).path,
      token: (signed as { token: string }).token,
    },
    inserted ? 201 : 200
  );
}
