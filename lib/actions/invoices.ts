"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";

type InvoiceStatus =
  | "draft"
  | "issued"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "voided"
  | "refunded"
  | "written_off";

const invoiceItemSchema = z.object({
  sortOrder: z.number().int().min(0),
  name: z.string().min(1, "Item name is required").max(300),
  description: z.string().max(2000).optional().nullable(),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0),
  taxable: z.boolean().default(true),
});

const invoiceSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  propertyId: z.string().uuid().optional().nullable(),
  jobId: z.string().uuid().optional().nullable(),
  estimateId: z.string().uuid().optional().nullable(),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  paymentTerms: z.number().int().min(0).default(30),
  taxRate: z.number().min(0).max(100).default(0),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required"),
  customerNotes: z.string().max(5000).optional().nullable(),
  internalNotes: z.string().max(5000).optional().nullable(),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;

function calcInvoiceTotals(items: InvoiceInput["items"], taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxableSubtotal = items
    .filter((i) => i.taxable)
    .reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxAmount = taxableSubtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export async function createInvoice(input: InvoiceInput) {
  const parsed = invoiceSchema.safeParse(input);
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
    .select("invoice_prefix")
    .single();

  const prefix = settings?.invoice_prefix ?? "INV";
  const year = new Date().getFullYear();

  const { data: numberData, error: rpcError } = await supabase.rpc("get_next_number", {
    prefix,
    year,
  });
  if (rpcError) return { error: "Failed to generate invoice number." };

  const d = parsed.data;
  const { subtotal, taxAmount, total } = calcInvoiceTotals(d.items, d.taxRate);

  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert({
      invoice_number: numberData as string,
      customer_id: d.customerId,
      property_id: d.propertyId ?? null,
      job_id: d.jobId ?? null,
      estimate_id: d.estimateId ?? null,
      status: "draft" as InvoiceStatus,
      issue_date: d.issueDate,
      due_date: d.dueDate,
      payment_terms: d.paymentTerms,
      subtotal,
      discount_amount: 0,
      tax_rate: d.taxRate,
      tax_amount: taxAmount,
      total,
      amount_paid: 0,
      balance_due: total,
      customer_notes: d.customerNotes ?? null,
      internal_notes: d.internalNotes ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !invoice) {
    return { error: "Failed to create invoice. Please try again." };
  }

  const itemRows = d.items.map((item) => ({
    invoice_id: invoice.id,
    sort_order: item.sortOrder,
    name: item.name,
    description: item.description ?? null,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total: item.quantity * item.unitPrice,
    taxable: item.taxable,
  }));

  const { error: itemsError } = await supabase.from("invoice_items").insert(itemRows);
  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { error: "Failed to save line items." };
  }

  await logAudit({
    action: "create",
    entityType: "invoice",
    entityId: invoice.id,
    afterData: { number: numberData, total },
  });

  revalidatePath("/invoices");
  return { id: invoice.id };
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const timestampFields: Partial<Record<string, string>> = {
    sent: "sent_at",
    viewed: "viewed_at",
    paid: "paid_at",
    voided: "voided_at",
  };

  const extra: Record<string, string> = {};
  const field = timestampFields[status];
  if (field) extra[field] = new Date().toISOString();

  const { error } = await supabase
    .from("invoices")
    .update({ status, updated_by: user.id, ...extra })
    .eq("id", id);

  if (error) return { error: "Failed to update invoice status." };

  await logAudit({ action: "status_change", entityType: "invoice", entityId: id, afterData: { status } });
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { success: true };
}

export async function recordPayment(
  invoiceId: string,
  amount: number,
  method: string,
  referenceNumber: string | null,
  paymentDate: string,
  notes: string | null
) {
  if (amount <= 0) return { error: "Payment amount must be greater than zero." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("customer_id, amount_paid, balance_due, total")
    .eq("id", invoiceId)
    .single();

  if (fetchError || !invoice) return { error: "Invoice not found." };

  const { error: paymentError } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    customer_id: invoice.customer_id,
    amount,
    payment_method: method,
    reference_number: referenceNumber ?? null,
    payment_date: paymentDate,
    notes: notes ?? null,
    recorded_by: user.id,
  });

  if (paymentError) return { error: "Failed to record payment." };

  const newAmountPaid = invoice.amount_paid + amount;
  const newBalanceDue = Math.max(0, invoice.balance_due - amount);
  const newStatus: InvoiceStatus = newBalanceDue <= 0 ? "paid" : "partially_paid";
  const extra: Record<string, string> = {};
  if (newBalanceDue <= 0) extra["paid_at"] = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      status: newStatus,
      updated_by: user.id,
      ...extra,
    })
    .eq("id", invoiceId);

  if (updateError) return { error: "Payment recorded but invoice update failed." };

  await logAudit({
    action: "payment_recorded",
    entityType: "invoice",
    entityId: invoiceId,
    afterData: { amount, method, newAmountPaid, newBalanceDue },
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/payments");
  return { success: true };
}
