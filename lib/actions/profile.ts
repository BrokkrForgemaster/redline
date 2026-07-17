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

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const firstName = (formData.get("first_name") as string)?.trim();
  const lastName = (formData.get("last_name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const file = formData.get("avatar") as File | null;

  if (!firstName || !lastName) {
    return { error: "First name and last name are required" };
  }

  let avatarUrl: string | undefined;

  if (file && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) {
      return { error: "Photo must be under 5 MB" };
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const storagePath = `${user.id}/avatar.${ext}`;
    const admin = getAdminClient();

    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(storagePath, file, { contentType: file.type, upsert: true });

    if (uploadError) return { error: `Photo upload failed: ${uploadError.message}` };

    const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(storagePath);
    // Append timestamp to bust Next.js image cache when the avatar changes
    avatarUrl = `${publicUrl}?t=${Date.now()}`;
  }

  const updateData: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    phone,
  };
  if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("profiles").update(updateData).eq("id", user.id);
  if (error) return { error: "Failed to save profile" };

  revalidatePath("/settings/profile");
  return { success: true };
}

export async function removeAvatar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { error: "Failed to remove photo" };

  revalidatePath("/settings/profile");
  return { success: true };
}
