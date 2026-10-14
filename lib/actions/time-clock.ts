"use server";

import { revalidatePath } from "next/cache";
import { requireStaffUser } from "@/lib/api/auth";

// Personal workday time is separate from job and service-visit transitions.
export async function clockInWorkday() {
  const access = await requireStaffUser();
  if (!access.ok) return { error: "An active staff account with verified MFA is required." };
  const { supabase, user } = access;
  const { data: open, error: lookupError } = await supabase.from("time_entries")
    .select("id").eq("employee_id", user.id).is("clock_out", null).limit(1);
  if (lookupError) return { error: "Could not check your current clock status. Try again." };
  if (open?.length) return { error: "You are already clocked in. Clock out of the current entry first." };
  const { data, error } = await supabase.from("time_entries")
    .insert({ employee_id: user.id, clock_in: new Date().toISOString(), job_id: null, is_manual: false })
    .select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? "You are already clocked in." : "Clock in was not saved. Try again." };
  revalidatePath("/time-tracking");
  return { id: data.id };
}

export async function clockOutWorkday(entryId: string) {
  const access = await requireStaffUser();
  if (!access.ok) return { error: "An active staff account with verified MFA is required." };
  const { supabase, user } = access;
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) return { error: "Invalid time entry." };
  const { data, error } = await supabase.from("time_entries")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", entryId)
    .eq("employee_id", user.id)
    .is("job_id", null)
    .is("clock_out", null)
    .select("id").maybeSingle();
  if (error || !data) return { error: "Clock out was not saved. Refresh and try again." };
  revalidatePath("/time-tracking");
  return { id: data.id };
}
