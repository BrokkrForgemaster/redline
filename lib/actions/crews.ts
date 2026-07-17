"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createCrew(data: {
  name: string;
  description?: string;
  leader_id?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.name?.trim()) return { error: "Crew name is required" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: crew, error } = await sb
    .from("crews")
    .insert({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      leader_id: data.leader_id || null,
    })
    .select("id")
    .single();

  if (error) return { error: "Failed to create crew" };

  // Add leader as a crew member automatically
  if (data.leader_id) {
    await sb.from("crew_members").insert({
      crew_id: crew.id,
      employee_id: data.leader_id,
      role: "leader",
    });
  }

  revalidatePath("/crews");
  return { id: crew.id };
}

export async function updateCrew(
  id: string,
  data: { name?: string; description?: string; leader_id?: string | null }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("crews")
    .update({
      name: data.name?.trim(),
      description: data.description?.trim() || null,
      leader_id: data.leader_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "Failed to update crew" };

  revalidatePath("/crews");
  revalidatePath(`/crews/${id}`);
  return { success: true };
}

export async function addCrewMember(crewId: string, employeeId: string, role: "leader" | "member") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("crew_members")
    .insert({ crew_id: crewId, employee_id: employeeId, role });

  if (error) {
    if (error.code === "23505") return { error: "This employee is already in the crew" };
    return { error: "Failed to add member" };
  }

  revalidatePath(`/crews/${crewId}`);
  return { success: true };
}

export async function removeCrewMember(crewId: string, employeeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("crew_members")
    .delete()
    .eq("crew_id", crewId)
    .eq("employee_id", employeeId);

  if (error) return { error: "Failed to remove member" };

  revalidatePath(`/crews/${crewId}`);
  return { success: true };
}

export async function deactivateCrew(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("crews")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "Failed to deactivate crew" };

  revalidatePath("/crews");
  return { success: true };
}
