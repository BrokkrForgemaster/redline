"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { ADMIN_EMAILS, DEVELOPER_EMAILS } from "@/lib/auth/privileged-users";

type GpsPayload = {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  captured_at_device: string;
};

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
  await (supabase as any).from("job_location_tags").insert({
    job_id: jobId,
    employee_id: userId,
    job_photo_id: jobPhotoId ?? null,
    tag_type: tagType,
    latitude: gps.latitude,
    longitude: gps.longitude,
    accuracy_meters: gps.accuracy_meters,
    captured_at_device: gps.captured_at_device,
  });
}

async function notifyPrivilegedUsersOfLegacyJobEvent(
  event: "start" | "finish",
  jobId: string,
  actorId: string
) {
  const admin = getAdminClient();
  const recipientEmails = [...ADMIN_EMAILS, ...DEVELOPER_EMAILS];

  const [{ data: recipients }, { data: job }, { data: actor }] = await Promise.all([
    admin
      .from("profiles")
      .select("id")
      .in("email", recipientEmails)
      .eq("status", "active"),
    admin
      .from("jobs")
      .select("job_number, title")
      .eq("id", jobId)
      .single(),
    admin
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", actorId)
      .single(),
  ]);

  const recipientIds = ((recipients ?? []) as { id: string }[]).map((recipient) => recipient.id);
  if (recipientIds.length === 0) return;

  const worker = actor ? `${actor.first_name} ${actor.last_name}`.trim() || actor.email : "A subcontractor";
  const action = event === "start" ? "started" : "ended";
  const title = event === "start" ? "Job started" : "Job ended";
  const body = `${worker} ${action} ${job?.job_number ?? "a job"}${job?.title ? `: ${job.title}` : ""}.`;

  const { error } = await admin.from("notifications").insert(
    recipientIds.map((userId) => ({
      user_id: userId,
      type: `job_${event}`,
      title,
      body,
      action_url: `/jobs/${jobId}`,
      entity_type: "job",
      entity_id: jobId,
    }))
  );

  if (error) console.error("Failed to insert admin legacy job notification", error);
}

export async function clockIn(jobId: string, gps?: GpsPayload | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Guard: employee must not already be clocked in anywhere
  const { data: existing } = await sb
    .from("time_entries")
    .select("id, job_id")
    .eq("employee_id", user.id)
    .is("clock_out", null)
    .maybeSingle();

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

  // Advance job status if it hasn't started yet
  await sb
    .from("jobs")
    .update({ status: "in_progress" })
    .eq("id", jobId)
    .in("status", ["scheduled", "en_route", "arrived", "approved", "ready_to_schedule"]);

  await insertLocationTag(supabase, jobId, user.id, "start", gps ?? null);
  await notifyPrivilegedUsersOfLegacyJobEvent("start", jobId, user.id).catch((error) => {
    console.error("Failed to notify privileged users of job start", error);
  });

  revalidatePath(`/my-jobs/${jobId}`);
  revalidatePath("/my-jobs");
  return { entryId: (data as { id: string }).id };
}

export async function clockOut(entryId: string, jobId: string, gps?: GpsPayload | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = getAdminClient();
  const { data: updatedEntry, error } = await admin
    .from("time_entries")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", entryId)
    .eq("employee_id", user.id)
    .is("clock_out", null)
    .select("id")
    .maybeSingle();

  if (error || !updatedEntry) return { error: "Failed to clock out. Please try again." };

  await insertLocationTag(supabase, jobId, user.id, "finish", gps ?? null);
  await notifyPrivilegedUsersOfLegacyJobEvent("finish", jobId, user.id).catch((error) => {
    console.error("Failed to notify privileged users of job finish", error);
  });

  revalidatePath(`/my-jobs/${jobId}`);
  revalidatePath("/my-jobs");
  return { success: true };
}

export async function tagJobLocation(formData: FormData, jobId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const gps = parseGps(formData);
  if (!gps) return { error: "GPS location is required." };

  await insertLocationTag(supabase, jobId, user.id, "manual", gps);
  revalidatePath(`/my-jobs/${jobId}`);
  return { success: true };
}

export async function uploadJobPhoto(formData: FormData, jobId: string, type: "before" | "after") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };
  const gps = parseGps(formData);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${jobId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = getAdminClient();
  const { error: uploadError } = await admin.storage
    .from("job-photos")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: { publicUrl } } = admin.storage.from("job-photos").getPublicUrl(storagePath);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photo, error: dbError } = await (supabase as any)
    .from("job_photos")
    .insert({
      job_id: jobId,
      employee_id: user.id,
      storage_path: storagePath,
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
  return { url: publicUrl };
}
