"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { canWorkLegacyJob } from "@/lib/api/legacy-job-access";
import { verifyStoredImage } from "@/lib/media/verify-image";
import { hasMfaAssurance } from "@/lib/api/auth";

type GpsPayload = {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  captured_at_device: string;
};

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const ALLOWED_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function inferPhotoMimeType(file: File) {
  const type = file.type?.toLowerCase();
  if (type && ALLOWED_PHOTO_MIME_TYPES.has(type)) return type;

  const ext = file.name.split(".").pop()?.toLowerCase();
  const mimeByExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };

  return ext ? mimeByExt[ext] ?? "" : "";
}

function photoExtension(mimeType: string, fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }

  const extByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };

  return extByMime[mimeType] ?? "jpg";
}

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function parseGps(formData: FormData): GpsPayload | null {
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const accuracy = Number(formData.get("accuracy_meters"));
  const captured = String(formData.get("captured_at_device") ?? "");

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(accuracy) ||
    !captured
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy_meters: accuracy,
    captured_at_device: captured,
  };
}

async function insertLocationTag(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  userId: string,
  tagType: "manual" | "start" | "finish" | "photo_before" | "photo_after",
  gps: GpsPayload | null,
  jobPhotoId?: string
) {
  if (!gps) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("job_location_tags").insert({
    job_id: jobId,
    employee_id: userId,
    job_photo_id: jobPhotoId ?? null,
    tag_type: tagType,
    latitude: gps.latitude,
    longitude: gps.longitude,
    accuracy_meters: gps.accuracy_meters,
    captured_at_device: gps.captured_at_device,
  });
  if (error) throw new Error("Location tag was not saved.");
}

export async function clockIn(jobId: string, gps?: GpsPayload | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await canWorkLegacyJob(user.id, jobId))) return { error: "Active assignment required." };
  if (!(await hasMfaAssurance(supabase))) return { error: "Verified MFA is required." };

  const admin = getAdminClient();
  const [{ count: tags, error: tagError }, { count: photos, error: photoError }] = await Promise.all([
    admin.from("job_location_tags").select("id", { count: "exact", head: true })
      .eq("job_id", jobId).eq("employee_id", user.id).eq("tag_type", "manual"),
    admin.from("job_photos").select("id", { count: "exact", head: true })
      .eq("job_id", jobId).eq("employee_id", user.id).eq("photo_type", "before"),
  ]);
  if (tagError || photoError) return { error: "Could not verify this job's location and before photos." };
  if (!tags || (photos ?? 0) < 3) return { error: "Tag this job's location and save three before photos before clocking in." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // The personal workday clock is independent. Limit only overlapping job entries.
  const { data: openJobs, error: lookupError } = await sb
    .from("time_entries")
    .select("id, job_id")
    .eq("employee_id", user.id)
    .not("job_id", "is", null)
    .is("clock_out", null)
    .limit(1);

  if (lookupError) return { error: "Could not check your current job clock. Try again." };
  const existing = openJobs?.[0];
  if (existing) {
    if (existing.job_id === jobId) return { error: "You are already clocked in to this job." };
    return { error: "You are clocked in to another job. Please clock out first." };
  }

  const { data, error } = await sb
    .from("time_entries")
    .insert({ employee_id: user.id, job_id: jobId, clock_in: new Date().toISOString() })
    .select("id")
    .single();

  if (error) return { error: "Failed to clock in. Please try again." };

  await insertLocationTag(supabase, jobId, user.id, "start", gps ?? null);

  revalidatePath(`/my-jobs/${jobId}`);
  revalidatePath("/my-jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { entryId: (data as { id: string }).id };
}

export async function clockOut(entryId: string, jobId: string, gps?: GpsPayload | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await canWorkLegacyJob(user.id, jobId))) return { error: "Active assignment required." };
  if (!(await hasMfaAssurance(supabase))) return { error: "Verified MFA is required." };
  if (!gps) return { error: "A current GPS location is required to finish this job." };
  // The function saves the finish tag, closes this worker's job clock and
  // updates the shared one-time job with history and alerts in one transaction.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("finish_legacy_job_clock", {
    p_entry_id: entryId,
    p_job_id: jobId,
    p_latitude: gps.latitude,
    p_longitude: gps.longitude,
    p_accuracy_meters: gps.accuracy_meters,
    p_captured_at_device: gps.captured_at_device,
  });
  if (error || !data?.clockOut || data.entryId !== entryId) {
    return { error: "Job finish was not confirmed. Keep the photos and retry after checking your connection and GPS." };
  }

  revalidatePath(`/my-jobs/${jobId}`);
  revalidatePath("/my-jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true, jobStatus: data.jobStatus as string };
}

export async function tagJobLocation(formData: FormData, jobId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await canWorkLegacyJob(user.id, jobId))) return { error: "Active assignment required." };
  if (!(await hasMfaAssurance(supabase))) return { error: "Verified MFA is required." };

  const gps = parseGps(formData);
  if (!gps) return { error: "GPS location is required." };

  try {
    await insertLocationTag(supabase, jobId, user.id, "manual", gps);
  } catch {
    return { error: "Location tag was not saved. Please try again." };
  }
  revalidatePath(`/my-jobs/${jobId}`);
  return { success: true };
}

export async function uploadJobPhoto(formData: FormData, jobId: string, type: "before" | "after") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await canWorkLegacyJob(user.id, jobId))) return { error: "Active assignment required." };
  if (!(await hasMfaAssurance(supabase))) return { error: "Verified MFA is required." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };
  if (file.size > MAX_PHOTO_BYTES) {
    return { error: "Photo is too large. Please retake it or choose a smaller image." };
  }

  const mimeType = inferPhotoMimeType(file);
  if (!mimeType || !ALLOWED_PHOTO_MIME_TYPES.has(mimeType)) {
    return { error: "Unsupported photo type. Please upload a JPG, PNG, WebP, HEIC, or HEIF image." };
  }
  try {
    await verifyStoredImage(Buffer.from(await file.arrayBuffer()), mimeType);
  } catch {
    return { error: "Photo is corrupt or its format does not match the selected file." };
  }

  const gps = parseGps(formData);

  const ext = photoExtension(mimeType, file.name);
  const storagePath = `${jobId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = getAdminClient();
  const { error: uploadError } = await admin.storage
    .from("job-photos")
    .upload(storagePath, file, { contentType: mimeType, upsert: false });

  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: { publicUrl } } = admin.storage.from("job-photos").getPublicUrl(storagePath);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photo, error: dbError } = await (supabase as any)
    .from("job_photos")
    .insert({
      job_id: jobId,
      employee_id: user.id,
      storage_path: storagePath,
      // Keep the historical column populated; authorized reads use signed URLs.
      url: publicUrl,
      photo_type: type,
      latitude: gps?.latitude ?? null,
      longitude: gps?.longitude ?? null,
      accuracy_meters: gps?.accuracy_meters ?? null,
      captured_at_device: gps?.captured_at_device ?? null,
    })
    .select("id")
    .single();

  if (dbError) {
    await admin.storage.from("job-photos").remove([storagePath]);
    return { error: "Failed to save photo." };
  }

  await insertLocationTag(
    supabase,
    jobId,
    user.id,
    type === "before" ? "photo_before" : "photo_after",
    gps,
    (photo as { id: string } | null)?.id
  );

  revalidatePath(`/my-jobs/${jobId}`);
  return { photo_id: (photo as { id: string }).id };
}
