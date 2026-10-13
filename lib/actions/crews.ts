"use server";

import { requireStaffUser } from "@/lib/api/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const crewId = z.uuid();
const createInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  leader_id: crewId.nullish(),
}).strict();
const updateInput = createInput.partial();

async function applyCrewChange(action: string, id: string | null, payload: Record<string, unknown>) {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) return { error: "Active Admin account with verified MFA required" };

  // The database function checks owner, assurance, staff eligibility, and
  // commits the crew, membership and audit changes in one transaction.
  const { data, error } = await access.supabase.rpc("apply_crew_change" as never, {
    p_action: action,
    p_crew_id: id,
    p_payload: payload,
  } as never);
  if (error || !data) {
    if (error?.code === "23505") return { error: "This employee is already in the crew" };
    if (error?.code === "P0002") return { error: "Crew or member was not found" };
    if (error?.code === "23514") return { error: "Crew leader and membership are inconsistent" };
    return { error: "Crew change was not saved. Check the staff role and retry." };
  }
  revalidatePath("/crews");
  revalidatePath(`/crews/${data}`);
  return { id: data, success: true };
}

export async function createCrew(data: {
  name: string;
  description?: string;
  leader_id?: string;
}) {
  const parsed = createInput.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid crew" };
  return applyCrewChange("create", null, parsed.data);
}

export async function updateCrew(
  id: string,
  data: { name?: string; description?: string; leader_id?: string | null }
) {
  if (!crewId.safeParse(id).success) return { error: "Invalid crew ID" };
  const parsed = updateInput.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid crew" };
  if (Object.keys(parsed.data).length === 0) return { error: "No crew changes supplied" };
  return applyCrewChange("update", id, parsed.data);
}

export async function addCrewMember(crewIdValue: string, employeeId: string, role: "leader" | "member") {
  if (!crewId.safeParse(crewIdValue).success || !crewId.safeParse(employeeId).success ||
      (role !== "leader" && role !== "member")) return { error: "Invalid crew member" };
  return applyCrewChange("add_member", crewIdValue, { employee_id: employeeId, role });
}

export async function removeCrewMember(crewIdValue: string, employeeId: string) {
  if (!crewId.safeParse(crewIdValue).success || !crewId.safeParse(employeeId).success) {
    return { error: "Invalid crew member" };
  }
  return applyCrewChange("remove_member", crewIdValue, { employee_id: employeeId });
}

export async function deactivateCrew(id: string) {
  if (!crewId.safeParse(id).success) return { error: "Invalid crew ID" };
  return applyCrewChange("deactivate", id, {});
}
