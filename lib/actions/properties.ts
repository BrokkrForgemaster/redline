"use server";

import { propertySchema, type PropertyInput } from "@/lib/validations/customer";
import { logAudit } from "./audit";
import { revalidatePath } from "next/cache";
import { requireStaffUser } from "@/lib/api/auth";

export async function createProperty(input: PropertyInput) {
  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  if (parsed.data.gateCode) return { error: "Gate codes need a secure access workflow before saving." };

  const access = await requireStaffUser("reviewer");
  if (!access.ok) return { error: "Active Admin account with verified MFA required" };
  const supabase = access.supabase;
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
      bed_area_sqft: d.bedAreaSqft ?? null,
      sidewalk_area_sqft: d.sidewalkAreaSqft ?? null,
      parking_area_sqft: d.parkingAreaSqft ?? null,
      driveway_area_sqft: d.drivewayAreaSqft ?? null,
      snow_service_area_sqft: d.snowServiceAreaSqft ?? null,
      salt_treatment_area_sqft: d.saltTreatmentAreaSqft ?? null,
      access_instructions: d.accessInstructions ?? null,
      water_access_notes: d.waterAccessNotes ?? null,
      irrigation_notes: d.irrigationNotes ?? null,
      hazards: d.hazards ?? null,
      utility_notes: d.utilityNotes ?? null,
      preferred_service_days: d.preferredServiceDays,
      service_restrictions: d.serviceRestrictions ?? null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
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
  if (parsed.data.gateCode) return { error: "Gate codes need a secure access workflow before saving." };

  const access = await requireStaffUser("reviewer");
  if (!access.ok) return { error: "Active Admin account with verified MFA required" };
  const supabase = access.supabase;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const d = parsed.data;

  const { data: saved, error } = await supabase
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
      bed_area_sqft: d.bedAreaSqft ?? null,
      sidewalk_area_sqft: d.sidewalkAreaSqft ?? null,
      parking_area_sqft: d.parkingAreaSqft ?? null,
      driveway_area_sqft: d.drivewayAreaSqft ?? null,
      snow_service_area_sqft: d.snowServiceAreaSqft ?? null,
      salt_treatment_area_sqft: d.saltTreatmentAreaSqft ?? null,
      access_instructions: d.accessInstructions ?? null,
      water_access_notes: d.waterAccessNotes ?? null,
      irrigation_notes: d.irrigationNotes ?? null,
      hazards: d.hazards ?? null,
      utility_notes: d.utilityNotes ?? null,
      preferred_service_days: d.preferredServiceDays,
      service_restrictions: d.serviceRestrictions ?? null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      pets_on_property: d.petsOnProperty,
      property_notes: d.propertyNotes ?? null,
      active: d.active,
      updated_by: user.id,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !saved) {
    return { error: "Property was not saved. Check access and retry." };
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
