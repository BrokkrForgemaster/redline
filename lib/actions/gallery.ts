"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";
import { hasMfaAssurance } from "@/lib/api/auth";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function requireGalleryManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile, error } = await supabase.from("profiles")
    .select("role, status").eq("id", user.id).single();
  if (error || profile?.status !== "active" || profile.role !== "owner") return null;
  if (!(await hasMfaAssurance(supabase))) return null;
  return { supabase, user };
}

export async function createGalleryProject(input: Record<string, unknown>) {
  const manager = await requireGalleryManager();
  if (!manager) return { error: "Not authorized" };
  const { supabase, user } = manager;

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
  const manager = await requireGalleryManager();
  if (!manager) return { error: "Not authorized" };
  const { supabase, user } = manager;

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
  const manager = await requireGalleryManager();
  if (!manager) return { error: "Not authorized" };
  const { supabase } = manager;

  const { data: project } = await supabase.from("gallery_projects").select("id").eq("id", id).maybeSingle();
  if (!project) return { error: "Project not found" };

  // Fetch storage paths of all images before deleting
  const { data: images } = await supabase
    .from("gallery_images")
    .select("storage_path")
    .eq("project_id", id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: deleted, error } = await sb.from("gallery_projects").delete().eq("id", id).select("id").maybeSingle();
  if (error || !deleted) return { error: "Failed to delete project" };

  const paths = ((images ?? []) as { storage_path: string }[]).map(i => i.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await getAdminClient().storage.from("gallery").remove(paths);
    if (storageError) return { error: "Project deleted; image cleanup needs attention" };
  }

  await logAudit({ action: "delete", entityType: "gallery_project", entityId: id });

  revalidatePath("/media");
  revalidatePath("/gallery");
  return { success: true };
}

export async function uploadGalleryImage(formData: FormData, projectId: string) {
  const manager = await requireGalleryManager();
  if (!manager) return { error: "Not authorized" };
  const { supabase, user } = manager;
  const { data: project, error: projectError } = await supabase.from("gallery_projects")
    .select("id").eq("id", projectId).maybeSingle();
  if (projectError || !project) return { error: "Project not found" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };
  if (file.size < 1 || file.size > 15 * 1024 * 1024) return { error: "Image must be under 15 MB" };
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const png = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  const webp = String.fromCharCode(...header.slice(0, 4)) === "RIFF" && String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) return { error: "Unsupported image content" };

  const ext = jpeg ? "jpg" : png ? "png" : "webp";
  const storagePath = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = getAdminClient();
  const { error: uploadError } = await admin.storage
    .from("gallery")
    .upload(storagePath, file, { contentType: jpeg ? "image/jpeg" : png ? "image/png" : "image/webp", upsert: false });

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

export async function deleteGalleryImage(imageId: string) {
  const manager = await requireGalleryManager();
  if (!manager) return { error: "Not authorized" };
  const { supabase } = manager;

  const { data: image, error: lookupError } = await supabase.from("gallery_images")
    .select("id, storage_path").eq("id", imageId).maybeSingle();
  if (lookupError || !image) return { error: "Image not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: deleted, error } = await sb.from("gallery_images").delete().eq("id", imageId).select("id").maybeSingle();
  if (error || !deleted) return { error: "Failed to delete image" };

  if (image.storage_path) {
    const admin = getAdminClient();
    const { error: storageError } = await admin.storage.from("gallery").remove([image.storage_path]);
    if (storageError) return { error: "Image record deleted; storage cleanup needs attention" };
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
  const manager = await requireGalleryManager();
  if (!manager) return { error: "Not authorized" };
  const { supabase } = manager;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("gallery_images").update(data).eq("id", imageId);
  if (error) return { error: "Failed to update image" };

  return { success: true };
}
