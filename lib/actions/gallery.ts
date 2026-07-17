"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function createGalleryProject(input: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const result = await sb.from("gallery_projects").insert({
    ...input,
    created_by: user.id,
    display_order: 99,
  }).select("id").single();

  const { data, error } = result as { data: { id: string } | null; error: { message: string } | null };

  if (error) return { error: "Failed to create project" };

  await logAudit({
    action: "create",
    entityType: "gallery_project",
    entityId: data!.id,
  });

  revalidatePath("/media");
  return { id: data!.id };
}

export async function updateGalleryProject(id: string, input: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const result = await sb.from("gallery_projects").update({ ...input, updated_by: user.id }).eq("id", id);
  const { error } = result as { error: { message: string } | null };

  if (error) return { error: "Failed to update project" };

  await logAudit({
    action: "update",
    entityType: "gallery_project",
    entityId: id,
  });

  revalidatePath("/media");
  revalidatePath(`/media/${id}/edit`);
  revalidatePath("/gallery");
  return { success: true };
}

export async function deleteGalleryProject(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch storage paths of all images before deleting
  const { data: images } = await supabase
    .from("gallery_images")
    .select("storage_path")
    .eq("project_id", id);

  // Delete storage files
  const admin = getAdminClient();
  if (images && images.length > 0) {
    const paths = (images as { storage_path: string }[])
      .map(i => i.storage_path)
      .filter(Boolean);
    if (paths.length > 0) {
      await admin.storage.from("gallery").remove(paths);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("gallery_projects").delete().eq("id", id);
  if (error) return { error: "Failed to delete project" };

  await logAudit({ action: "delete", entityType: "gallery_project", entityId: id });

  revalidatePath("/media");
  revalidatePath("/gallery");
  return { success: true };
}

export async function uploadGalleryImage(formData: FormData, projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = getAdminClient();
  const { error: uploadError } = await admin.storage
    .from("gallery")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: { publicUrl } } = admin.storage.from("gallery").getPublicUrl(storagePath);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existing } = await sb
    .from("gallery_images")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = ((existing as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data: record, error: dbError } = await sb
    .from("gallery_images")
    .insert({
      project_id: projectId,
      storage_path: storagePath,
      url: publicUrl,
      alt_text: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      image_type: "general",
      sort_order: nextOrder,
      created_by: user.id,
    })
    .select("id, url, thumbnail_url, caption, alt_text, image_type, sort_order, storage_path")
    .single();

  if (dbError) {
    await admin.storage.from("gallery").remove([storagePath]);
    return { error: "Failed to save image record" };
  }

  revalidatePath(`/media/${projectId}/edit`);
  revalidatePath("/gallery");
  return { image: record as {
    id: string;
    url: string;
    thumbnail_url: string | null;
    caption: string | null;
    alt_text: string;
    image_type: string | null;
    sort_order: number | null;
    storage_path: string;
  }};
}

export async function deleteGalleryImage(imageId: string, storagePath: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("gallery_images").delete().eq("id", imageId);
  if (error) return { error: "Failed to delete image" };

  if (storagePath) {
    const admin = getAdminClient();
    await admin.storage.from("gallery").remove([storagePath]);
  }

  revalidatePath("/media");
  revalidatePath("/gallery");
  return { success: true };
}

export async function updateGalleryImage(imageId: string, data: {
  caption?: string;
  alt_text?: string;
  image_type?: string;
  sort_order?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("gallery_images").update(data).eq("id", imageId);
  if (error) return { error: "Failed to update image" };

  return { success: true };
}
