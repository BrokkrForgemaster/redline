"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasMfaAssurance } from "@/lib/api/auth";
import { createSupportSchema, replySupportSchema, changeSupportStatusSchema } from "@/lib/validations/support";

export async function createSupportRequest(input: unknown) {
  const parsed = createSupportSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the request." };
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in to send a support request." };
  const { data: profile } = await sb.from("profiles").select("role, status").eq("id", user.id).single();
  if (profile?.role !== "owner" || profile.status !== "active" || !(await hasMfaAssurance(sb))) {
    return { ok: false as const, error: "Owner access with verified MFA is required." };
  }
  // SQL rechecks identity and writes request, first reply and inbox together.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("create_support_ticket", {
    p_subject: parsed.data.subject,
    p_category: parsed.data.category,
    p_affected_page: parsed.data.affectedPage,
    p_body: parsed.data.body,
  });
  if (error || typeof data !== "string") return { ok: false as const, error: "Could not save the support request. Please retry." };
  revalidatePath("/support");
  return { ok: true as const, id: data };
}

export async function replyToSupportRequest(input: unknown) {
  const parsed = replySupportSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the reply." };
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in to reply." };
  const { data: profile } = await sb.from("profiles").select("role, status").eq("id", user.id).single();
  if (profile?.status !== "active" || !["owner", "developer"].includes(profile.role) || !(await hasMfaAssurance(sb))) {
    return { ok: false as const, error: "Support access with verified MFA is required." };
  }
  // The function checks current ticket scope under a row lock.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("reply_support_ticket", {
    p_ticket_id: parsed.data.ticketId, p_body: parsed.data.body,
  });
  if (error || typeof data !== "string") return { ok: false as const, error: "Could not save the reply. Please retry." };
  revalidatePath(`/support/${parsed.data.ticketId}`);
  revalidatePath("/support");
  return { ok: true as const, id: data };
}

export async function changeSupportRequestStatus(input: unknown) {
  const parsed = changeSupportStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Choose a valid support status." };
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in to update support status." };
  const { data: profile } = await sb.from("profiles").select("role, status").eq("id", user.id).single();
  if (profile?.status !== "active" || !["owner", "developer"].includes(profile.role) || !(await hasMfaAssurance(sb))) {
    return { ok: false as const, error: "Support access with verified MFA is required." };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("change_support_ticket_status", {
    p_ticket_id: parsed.data.ticketId, p_status: parsed.data.status,
  });
  if (error || data !== parsed.data.status) return { ok: false as const, error: "Could not save the support status." };
  revalidatePath(`/support/${parsed.data.ticketId}`);
  revalidatePath("/support");
  return { ok: true as const };
}
