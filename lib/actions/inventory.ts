"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  unitOfMeasure: z.string().min(1, "Unit of measure is required"),
  purchaseCost: z.number().min(0).default(0),
  billablePrice: z.number().min(0).default(0),
  reorderPoint: z.number().int().min(0).default(0),
  reorderQuantity: z.number().int().min(0).default(0),
  currentQuantity: z.number().min(0).default(0),
  minStock: z.number().min(0).default(0),
  maxStock: z.number().min(0).default(0),
  taxable: z.boolean().default(true),
  active: z.boolean().default(true),
  supplierId: z.string().uuid().optional().nullable(),
  location: z.string().optional().nullable(),
  bin: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  manufacturerPart: z.string().optional().nullable(),
});

export type ProductInput = z.infer<typeof productSchema>;

export async function createProduct(input: ProductInput) {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues ?? [];
    return { error: issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const result = await sb.from("products").insert({
    name: d.name,
    category: d.category,
    unit_of_measure: d.unitOfMeasure,
    purchase_cost: d.purchaseCost,
    billable_price: d.billablePrice,
    reorder_point: d.reorderPoint,
    reorder_quantity: d.reorderQuantity,
    current_quantity: d.currentQuantity,
    reserved_quantity: 0,
    min_stock: d.minStock,
    max_stock: d.maxStock,
    taxable: d.taxable,
    active: d.active,
    supplier_id: d.supplierId ?? null,
    location: d.location ?? null,
    bin: d.bin ?? null,
    brand: d.brand ?? null,
    sku: d.sku ?? null,
    barcode: d.barcode ?? null,
    manufacturer_part: d.manufacturerPart ?? null,
    created_by: user.id,
  }).select("id").single();

  const { data, error } = result as { data: { id: string } | null; error: { message: string } | null };

  if (error) {
    return { error: "Failed to create item. Please try again." };
  }

  await logAudit({
    action: "create",
    entityType: "product",
    entityId: data!.id,
    afterData: { name: d.name, category: d.category },
  });

  revalidatePath("/inventory");
  return { id: data!.id };
}

export async function updateProduct(id: string, input: ProductInput) {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues ?? [];
    return { error: issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const result = await sb.from("products").update({
    name: d.name,
    category: d.category,
    unit_of_measure: d.unitOfMeasure,
    purchase_cost: d.purchaseCost,
    billable_price: d.billablePrice,
    reorder_point: d.reorderPoint,
    reorder_quantity: d.reorderQuantity,
    current_quantity: d.currentQuantity,
    min_stock: d.minStock,
    max_stock: d.maxStock,
    taxable: d.taxable,
    active: d.active,
    supplier_id: d.supplierId ?? null,
    location: d.location ?? null,
    bin: d.bin ?? null,
    brand: d.brand ?? null,
    sku: d.sku ?? null,
    barcode: d.barcode ?? null,
    manufacturer_part: d.manufacturerPart ?? null,
  }).eq("id", id);

  const { error } = result as { error: { message: string } | null };

  if (error) {
    return { error: "Failed to update item." };
  }

  await logAudit({
    action: "update",
    entityType: "product",
    entityId: id,
  });

  revalidatePath(`/inventory/${id}`);
  revalidatePath("/inventory");
  return { id };
}
