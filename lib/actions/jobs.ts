"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStaffUser } from "@/lib/api/auth";
import { jobSchema, type JobInput } from "@/lib/validations/job";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";

async function getJobNumber(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  try {
    const { data: settings } = await supabase
      .from("business_settings")
      .select("job_prefix")
      .single();

    const prefix = settings?.job_prefix ?? "JOB";
    const year = new Date().getFullYear();

    const { data } = await supabase.rpc("get_next_number", { prefix, year });
    if (data) return data as string;
  } catch {
    // fallback
  }
  return `JOB-${Date.now()}`;
}

export async function createJob(input: JobInput) {
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const access = await requireStaffUser("reviewer");
  if (!access.ok) return { error: "Active Admin account with verified MFA required" };
  const { supabase, user } = access;

  const d = parsed.data;
  const jobNumber = await getJobNumber(supabase);

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      job_number: jobNumber,
      customer_id: d.customerId,
      property_id: d.propertyId ?? null,
      estimate_id: d.estimateId ?? null,
      contract_id: d.contractId ?? null,
      service_type: d.serviceType,
      priority: d.priority,
      status: "approved",
      title: d.title,
      description: d.description ?? null,
      crew_id: d.crewId ?? null,
      scheduled_date: d.scheduledDate ?? null,
      scheduled_start: d.scheduledStart ?? null,
      scheduled_end: d.scheduledEnd ?? null,
      estimated_hours: d.estimatedHours ?? null,
      work_instructions: d.workInstructions ?? null,
      access_notes: d.accessNotes ?? null,
      is_recurring: d.isRecurring,
      recurrence_rule: d.recurrenceRule ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create job. Please try again." };
  }

  await logAudit({
    action: "create",
    entityType: "job",
    entityId: data.id,
    afterData: { job_number: jobNumber, title: d.title, customer_id: d.customerId },
  });

  revalidatePath("/jobs");
  return { id: data.id };
}

export async function updateJob(id: string, input: JobInput) {
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const access = await requireStaffUser("reviewer");
  if (!access.ok) return { error: "Active Admin account with verified MFA required" };
  const { supabase, user } = access;

  const d = parsed.data;

  const { data: saved, error } = await supabase
    .from("jobs")
    .update({
      customer_id: d.customerId,
      property_id: d.propertyId ?? null,
      estimate_id: d.estimateId ?? null,
      contract_id: d.contractId ?? null,
      service_type: d.serviceType,
      priority: d.priority,
      title: d.title,
      description: d.description ?? null,
      crew_id: d.crewId ?? null,
      scheduled_date: d.scheduledDate ?? null,
      scheduled_start: d.scheduledStart ?? null,
      scheduled_end: d.scheduledEnd ?? null,
      estimated_hours: d.estimatedHours ?? null,
      work_instructions: d.workInstructions ?? null,
      access_notes: d.accessNotes ?? null,
      is_recurring: d.isRecurring,
      recurrence_rule: d.recurrenceRule ?? null,
      updated_by: user.id,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !saved) {
    return { error: "Job was not saved. Check access and retry." };
  }

  await logAudit({
    action: "update",
    entityType: "job",
    entityId: id,
  });

  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  return { id };
}

export async function updateJobStatus(id: string, status: string) {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) return { error: "Active Admin account with verified MFA required" };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Invalid job" };
  const allowed = ["approved", "ready_to_schedule", "scheduled", "weather_delayed", "cancelled", "archived"];
  if (!allowed.includes(status)) return { error: "Use the visit workflow for field status changes." };

  const { error } = await access.supabase.rpc("change_legacy_job_status" as never,
    { p_job_id: id, p_status: status } as never);
  if (error) return { error: "Job status was not changed. Check its current state and retry." };

  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  return { success: true };
}
