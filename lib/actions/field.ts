"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function clockIn(jobId: string) {
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

  revalidatePath(`/my-jobs/${jobId}`);
  revalidatePath("/my-jobs");
  return { entryId: (data as { id: string }).id };
}

export async function clockOut(entryId: string, jobId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("time_entries")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", entryId)
    .eq("employee_id", user.id)
    .is("clock_out", null);

  if (error) return { error: "Failed to clock out. Please try again." };

  revalidatePath(`/my-jobs/${jobId}`);
  revalidatePath("/my-jobs");
  return { success: true };
}

export async function uploadJobPhoto(formData: FormData, jobId: string, type: "before" | "after") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${jobId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = getAdminClient();
  const { error: uploadError } = await admin.storage
    .from("job-photos")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: { publicUrl } } = admin.storage.from("job-photos").getPublicUrl(storagePath);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase as any).from("job_photos").insert({
    job_id: jobId,
    employee_id: user.id,
    storage_path: storagePath,
    url: publicUrl,
    photo_type: type,
  });

  if (dbError) {
    await admin.storage.from("job-photos").remove([storagePath]);
    return { error: "Failed to save photo." };
  }

  revalidatePath(`/my-jobs/${jobId}`);
  return { url: publicUrl };
}
