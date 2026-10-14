"use server";

import { requireStaffUser } from "@/lib/api/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const companyName = z.string().trim().min(1).max(120);
const id = z.uuid();

async function change(action: "create" | "add_member", companyId: string | null,
  payload: Record<string, string>) {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) return { error: "Active Admin account with verified MFA required" };
  const { data, error } = await access.supabase.rpc("manage_subcontractor_company" as never, {
    p_action: action, p_company_id: companyId, p_payload: payload,
  } as never);
  if (error || !data) {
    if (error?.code === "P0002") return { error: "Active company was not found" };
    if (error?.code === "22023") return { error: "Select an active Subcontractor account and company" };
    return { error: "Subcontractor change was not saved. Refresh and retry." };
  }
  revalidatePath("/subcontractors");
  revalidatePath("/crews/new");
  return { id: data as string };
}

export async function createSubcontractorCompany(name: string) {
  const parsed = companyName.safeParse(name);
  if (!parsed.success) return { error: "Company name must contain 1 to 120 characters" };
  return change("create", null, { name: parsed.data });
}

export async function addSubcontractorToCompany(companyId: string, userId: string,
  membershipRole: "owner" | "manager" | "member") {
  if (!id.safeParse(companyId).success || !id.safeParse(userId).success ||
      !["owner", "manager", "member"].includes(membershipRole)) {
    return { error: "Select a valid company and Subcontractor account" };
  }
  return change("add_member", companyId, { user_id: userId, membership_role: membershipRole });
}
