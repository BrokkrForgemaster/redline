"use server";

import { createClient } from "@/lib/supabase/server";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";

export async function createCustomer(input: CustomerInput) {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  const { data, error } = await supabase
    .from("customers")
    .insert({
      account_type: d.accountType,
      first_name: d.firstName,
      last_name: d.lastName,
      business_name: d.businessName ?? null,
      primary_contact: d.primaryContact ?? null,
      email: d.email,
      mobile_phone: d.mobilePhone ?? null,
      alternate_phone: d.alternatePhone ?? null,
      billing_address_line1: d.billingAddressLine1 ?? null,
      billing_address_line2: d.billingAddressLine2 ?? null,
      billing_city: d.billingCity ?? null,
      billing_state: d.billingState ?? null,
      billing_zip: d.billingZip ?? null,
      preferred_contact: d.preferredContact ?? null,
      customer_source: d.customerSource ?? null,
      tax_exempt: d.taxExempt,
      tax_exemption_id: d.taxExemptionId ?? null,
      internal_notes: d.internalNotes ?? null,
      tags: d.tags,
      portal_access: d.portalAccess,
      status: "active",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create customer. Please try again." };
  }

  await logAudit({
    action: "create",
    entityType: "customer",
    entityId: data.id,
    afterData: { name: `${d.firstName} ${d.lastName}`, email: d.email },
  });

  revalidatePath("/customers");
  return { id: data.id };
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  const { error } = await supabase
    .from("customers")
    .update({
      account_type: d.accountType,
      first_name: d.firstName,
      last_name: d.lastName,
      business_name: d.businessName ?? null,
      email: d.email,
      mobile_phone: d.mobilePhone ?? null,
      alternate_phone: d.alternatePhone ?? null,
      billing_address_line1: d.billingAddressLine1 ?? null,
      billing_address_line2: d.billingAddressLine2 ?? null,
      billing_city: d.billingCity ?? null,
      billing_state: d.billingState ?? null,
      billing_zip: d.billingZip ?? null,
      preferred_contact: d.preferredContact ?? null,
      customer_source: d.customerSource ?? null,
      tax_exempt: d.taxExempt,
      tax_exemption_id: d.taxExemptionId ?? null,
      internal_notes: d.internalNotes ?? null,
      tags: d.tags,
      portal_access: d.portalAccess,
      updated_by: user.id,
    })
    .eq("id", id);

  if (error) {
    return { error: "Failed to update customer." };
  }

  await logAudit({
    action: "update",
    entityType: "customer",
    entityId: id,
  });

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  return { id };
}

export async function archiveCustomer(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("customers")
    .update({ status: "archived", deleted_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", id);

  if (error) return { error: "Failed to archive customer." };

  await logAudit({ action: "archive", entityType: "customer", entityId: id });
  revalidatePath("/customers");
  return { success: true };
}
