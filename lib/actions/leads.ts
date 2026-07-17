"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";

const leadSchema = z.object({
  source: z.string().min(1, "Source is required").max(100),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  companyName: z.string().max(200).optional().nullable(),
  serviceAddress: z.string().max(500).optional().nullable(),
  requestedServices: z.array(z.string()).default([]),
  assignedTo: z.string().uuid().optional().nullable(),
  followUpDate: z.string().date().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  lossReason: z.string().max(2000).optional().nullable(),
});

export type LeadInput = z.infer<typeof leadSchema>;

export async function createLead(input: LeadInput) {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      source: d.source,
      first_name: d.firstName,
      last_name: d.lastName,
      email: d.email || null,
      phone: d.phone ?? null,
      company_name: d.companyName ?? null,
      service_address: d.serviceAddress ?? null,
      requested_services: d.requestedServices,
      status: "new",
      assigned_to: d.assignedTo ?? null,
      follow_up_date: d.followUpDate ?? null,
      notes: d.notes ?? null,
      loss_reason: d.lossReason ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create lead. Please try again." };
  }

  await logAudit({
    action: "create",
    entityType: "lead",
    entityId: data.id,
    afterData: { name: `${d.firstName} ${d.lastName}`, source: d.source },
  });

  revalidatePath("/leads");
  return { id: data.id };
}

export async function updateLead(id: string, input: LeadInput) {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  const { error } = await supabase
    .from("leads")
    .update({
      source: d.source,
      first_name: d.firstName,
      last_name: d.lastName,
      email: d.email || null,
      phone: d.phone ?? null,
      company_name: d.companyName ?? null,
      service_address: d.serviceAddress ?? null,
      requested_services: d.requestedServices,
      assigned_to: d.assignedTo ?? null,
      follow_up_date: d.followUpDate ?? null,
      notes: d.notes ?? null,
      loss_reason: d.lossReason ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Failed to update lead." };
  }

  await logAudit({
    action: "update",
    entityType: "lead",
    entityId: id,
  });

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  return { id };
}

export async function updateLeadStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("leads")
    .update({ status: status as never })
    .eq("id", id);

  if (error) {
    return { error: "Failed to update lead status." };
  }

  await logAudit({
    action: "status_change",
    entityType: "lead",
    entityId: id,
    afterData: { status },
  });

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  return { success: true };
}
