"use server";

import { createClient } from "@/lib/supabase/server";
import { hasMfaAssurance } from "@/lib/api/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canAssignStaffRole } from "@/lib/auth/roles";

const settingsSchema = z.object({
  business_name: z.string().trim().min(1).max(160).optional(),
  legal_name: z.string().trim().max(160).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.union([z.email(), z.literal("")]).nullable().optional(),
  website: z.string().trim().max(300).nullable().optional(),
  address_line1: z.string().trim().max(200).nullable().optional(),
  address_line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  zip: z.string().trim().max(30).nullable().optional(),
  tax_id: z.string().trim().max(60).nullable().optional(),
  default_tax_rate: z.coerce.number().min(0).max(100).optional(),
  currency: z.string().trim().length(3).optional(),
  timezone: z.string().trim().max(100).optional(),
  pdf_footer: z.string().max(4000).nullable().optional(),
  terms_and_conditions: z.string().max(10000).nullable().optional(),
}).strict();

async function ownerClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile, error } = await supabase.from("profiles")
    .select("role, status").eq("id", user.id).single();
  if (error || profile?.role !== "owner" || profile.status !== "active") return null;
  if (!(await hasMfaAssurance(supabase))) return null;
  return supabase;
}

export async function updateBusinessSettings(data: Record<string, unknown>) {
  const supabase = await ownerClient();
  if (!supabase) return { error: "Active owner account with verified MFA required" };
  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success || Object.keys(parsed.data).length === 0) return { error: "Invalid settings fields" };
  const { data: current, error: readError } = await supabase.from("business_settings").select("id").limit(2);
  if (readError || current?.length !== 1) return { error: "Business settings record unavailable" };
  const { data: saved, error } = await supabase.from("business_settings")
    .update(parsed.data).eq("id", current[0].id).select("id").single();
  if (error || !saved) return { error: "Failed to save settings" };
  revalidatePath("/settings/business");
  revalidatePath("/settings/branding");
  return { success: true };
}

export async function updateProfileRole(profileId: string, role: string) {
  const supabase = await ownerClient();
  if (!supabase) return { error: "Active owner account with verified MFA required" };
  if (!z.uuid().safeParse(profileId).success) {
    return { error: "Invalid staff role" };
  }
  const { data: target, error: targetError } = await supabase.from("profiles")
    .select("role").eq("id", profileId).single();
  if (targetError || !target || !canAssignStaffRole("owner", target.role, role)) return { error: "Invalid staff role" };
  const { error } = await supabase.rpc("change_staff_role" as never,
    { p_profile_id: profileId, p_role: role } as never);
  if (error) return { error: "Role change was not saved. Reauthenticate with MFA and retry." };
  revalidatePath("/settings/roles");
  return { success: true };
}
