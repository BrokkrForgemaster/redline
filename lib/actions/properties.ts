"use server";

import { createClient } from "@/lib/supabase/server";
import { propertySchema, type PropertyInput } from "@/lib/validations/customer";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";

export async function createProperty(input: PropertyInput) {
  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  const { data, error } = await supabase
    .from("properties")
    .insert({
      customer_id: d.customerId,
      property_name: d.propertyName ?? null,
      address_line1: d.addressLine1,
      address_line2: d.addressLine2 ?? null,
      city: d.city,
      state: d.state,
      zip: d.zip,
      property_type: d.propertyType,
      lot_size_sqft: d.lotSizeSqft ?? null,
      turf_area_sqft: d.turfAreaSqft ?? null,
      access_instructions: d.accessInstructions ?? null,
      pets_on_property: d.petsOnProperty,
      property_notes: d.propertyNotes ?? null,
      active: d.active,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create property. Please try again." };
  }

  await logAudit({
    action: "create",
    entityType: "property",
    entityId: data.id,
    afterData: { address: d.addressLine1, city: d.city, state: d.state },
  });

  revalidatePath("/properties");
  return { id: data.id };
}

export async function updateProperty(id: string, input: PropertyInput) {
  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  const { error } = await supabase
    .from("properties")
    .update({
      customer_id: d.customerId,
      property_name: d.propertyName ?? null,
      address_line1: d.addressLine1,
      address_line2: d.addressLine2 ?? null,
      city: d.city,
      state: d.state,
      zip: d.zip,
      property_type: d.propertyType,
      lot_size_sqft: d.lotSizeSqft ?? null,
      turf_area_sqft: d.turfAreaSqft ?? null,
      access_instructions: d.accessInstructions ?? null,
      pets_on_property: d.petsOnProperty,
      property_notes: d.propertyNotes ?? null,
      active: d.active,
      updated_by: user.id,
    })
    .eq("id", id);

  if (error) {
    return { error: "Failed to update property." };
  }

  await logAudit({
    action: "update",
    entityType: "property",
    entityId: id,
  });

  revalidatePath(`/properties/${id}`);
  revalidatePath("/properties");
  return { id };
}
