"use server";

import { createClient } from "@/lib/supabase/server";
import { estimateSchema, type EstimateInput } from "@/lib/validations/estimate";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";

type EstimateStatus =
  | "draft"
  | "ready_for_review"
  | "sent"
  | "viewed"
  | "changes_requested"
  | "approved"
  | "declined"
  | "expired"
  | "converted"
  | "voided";

function calcTotals(input: EstimateInput) {
  const { items, discountType, discountValue = 0, taxRate = 0, depositPercent = 0 } = input;

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount =
    discountType === "percent"
      ? subtotal * (discountValue / 100)
      : discountType === "fixed"
      ? discountValue
      : 0;
  const taxableSubtotal =
    items.filter((i) => i.taxable).reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) -
    discountAmount;
  const taxAmount = Math.max(0, taxableSubtotal) * (taxRate / 100);
  const total = subtotal - discountAmount + taxAmount;
  const depositAmount = total * (depositPercent / 100);

  return { subtotal, discountAmount, taxAmount, total, depositAmount };
}

export async function createEstimate(input: EstimateInput) {
  const parsed = estimateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: settings } = await supabase
    .from("business_settings")
    .select("estimate_prefix, default_tax_rate")
    .single();

  const prefix = settings?.estimate_prefix ?? "EST";
  const year = new Date().getFullYear();

  const { data: numberData, error: rpcError } = await supabase.rpc("get_next_number", {
    prefix,
    year,
  });
  if (rpcError) return { error: "Failed to generate estimate number." };

  const d = parsed.data;
  const { subtotal, discountAmount, taxAmount, total, depositAmount } = calcTotals(d);

  const { data: estimate, error: insertError } = await supabase
    .from("estimates")
    .insert({
      estimate_number: numberData as string,
      version: 1,
      customer_id: d.customerId,
      property_id: d.propertyId ?? null,
      estimator_id: d.estimatorId ?? null,
      status: "draft" as EstimateStatus,
      title: d.title,
      description: d.description ?? null,
      issue_date: d.issueDate,
      expiration_date: d.expirationDate ?? null,
      subtotal,
      discount_type: d.discountType ?? null,
      discount_value: d.discountValue ?? 0,
      discount_amount: discountAmount,
      tax_rate: d.taxRate ?? 0,
      tax_amount: taxAmount,
      total,
      deposit_percent: d.depositPercent ?? 0,
      deposit_amount: depositAmount,
      deposit_paid: 0,
      payment_terms: d.paymentTerms ?? null,
      customer_notes: d.customerNotes ?? null,
      internal_notes: d.internalNotes ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !estimate) {
    return { error: "Failed to create estimate. Please try again." };
  }

  const itemRows = d.items.map((item) => ({
    estimate_id: estimate.id,
    sort_order: item.sortOrder,
    item_type: item.itemType,
    name: item.name,
    description: item.description ?? null,
    quantity: item.quantity,
    unit: item.unit ?? null,
    unit_price: item.unitPrice,
    total: item.quantity * item.unitPrice,
    taxable: item.taxable,
    product_id: item.productId ?? null,
  }));

  const { error: itemsError } = await supabase.from("estimate_items").insert(itemRows);
  if (itemsError) {
    await supabase.from("estimates").delete().eq("id", estimate.id);
    return { error: "Failed to save line items." };
  }

  await logAudit({
    action: "create",
    entityType: "estimate",
    entityId: estimate.id,
    afterData: { number: numberData, title: d.title, total },
  });

  revalidatePath("/estimates");
  return { id: estimate.id };
}

export async function updateEstimate(id: string, input: EstimateInput) {
  const parsed = estimateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;
  const { subtotal, discountAmount, taxAmount, total, depositAmount } = calcTotals(d);

  const { error: updateError } = await supabase
    .from("estimates")
    .update({
      customer_id: d.customerId,
      property_id: d.propertyId ?? null,
      estimator_id: d.estimatorId ?? null,
      title: d.title,
      description: d.description ?? null,
      issue_date: d.issueDate,
      expiration_date: d.expirationDate ?? null,
      subtotal,
      discount_type: d.discountType ?? null,
      discount_value: d.discountValue ?? 0,
      discount_amount: discountAmount,
      tax_rate: d.taxRate ?? 0,
      tax_amount: taxAmount,
      total,
      deposit_percent: d.depositPercent ?? 0,
      deposit_amount: depositAmount,
      payment_terms: d.paymentTerms ?? null,
      customer_notes: d.customerNotes ?? null,
      internal_notes: d.internalNotes ?? null,
      updated_by: user.id,
    })
    .eq("id", id);

  if (updateError) return { error: "Failed to update estimate." };

  await supabase.from("estimate_items").delete().eq("estimate_id", id);

  const itemRows = d.items.map((item) => ({
    estimate_id: id,
    sort_order: item.sortOrder,
    item_type: item.itemType,
    name: item.name,
    description: item.description ?? null,
    quantity: item.quantity,
    unit: item.unit ?? null,
    unit_price: item.unitPrice,
    total: item.quantity * item.unitPrice,
    taxable: item.taxable,
    product_id: item.productId ?? null,
  }));

  const { error: itemsError } = await supabase.from("estimate_items").insert(itemRows);
  if (itemsError) return { error: "Failed to update line items." };

  await logAudit({
    action: "update",
    entityType: "estimate",
    entityId: id,
    afterData: { title: d.title, total },
  });

  revalidatePath(`/estimates/${id}`);
  revalidatePath("/estimates");
  return { id };
}

export async function updateEstimateStatus(id: string, status: EstimateStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const timestampField: Partial<Record<string, string>> = {
    sent: "sent_at",
    viewed: "viewed_at",
    approved: "approved_at",
    declined: "declined_at",
  };

  const extra: Record<string, string> = {};
  const field = timestampField[status];
  if (field) extra[field] = new Date().toISOString();

  const { error } = await supabase
    .from("estimates")
    .update({ status, updated_by: user.id, ...extra })
    .eq("id", id);

  if (error) return { error: "Failed to update status." };

  await logAudit({ action: "status_change", entityType: "estimate", entityId: id, afterData: { status } });
  revalidatePath(`/estimates/${id}`);
  revalidatePath("/estimates");
  return { success: true };
}
