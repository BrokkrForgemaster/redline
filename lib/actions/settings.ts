"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBusinessSettings(data: Record<string, unknown>) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const result = await sb.from("business_settings").update(data).not("id", "is", null);
  const { error } = result as { error: { message: string } | null };
  if (error) return { error: "Failed to save settings" };
  revalidatePath("/settings/business");
  revalidatePath("/settings/invoicing");
  revalidatePath("/settings/branding");
  return { success: true };
}

export async function updateProfileRole(profileId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const result = await sb.from("profiles").update({ role }).eq("id", profileId);
  const { error } = result as { error: { message: string } | null };

  if (error) return { error: "Failed to update role" };

  revalidatePath("/settings/roles");
  return { success: true };
}
