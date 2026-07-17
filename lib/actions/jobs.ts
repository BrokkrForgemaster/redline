"use server";

import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
      status: "pending_approval",
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  const { error } = await supabase
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
    .eq("id", id);

  if (error) {
    return { error: "Failed to update job." };
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("jobs")
    .update({ status: status as never, updated_by: user.id })
    .eq("id", id);

  if (error) {
    return { error: "Failed to update job status." };
  }

  await logAudit({
    action: "status_change",
    entityType: "job",
    entityId: id,
    afterData: { status },
  });

  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  return { success: true };
}
