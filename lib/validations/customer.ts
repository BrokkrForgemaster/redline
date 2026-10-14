import { z } from "zod";

// HTML inputs and selects send an empty string for an omitted optional value.
const optionalText = (schema: z.ZodString) => z.preprocess(
  value => typeof value === "string" && value.trim() === "" ? null : value,
  schema.optional().nullable()
);

export const customerSchema = z.object({
  accountType: z.enum(["individual", "business"]),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  businessName: optionalText(z.string().max(200)),
  primaryContact: optionalText(z.string().max(100)),
  email: z.string().email("Please enter a valid email address"),
  mobilePhone: optionalText(z.string().regex(/^[\d\s\-\(\)\+\.]+$/, "Please enter a valid phone number")),
  alternatePhone: optionalText(z.string().regex(/^[\d\s\-\(\)\+\.]+$/, "Please enter a valid phone number")),
  billingAddressLine1: optionalText(z.string().max(200)),
  billingAddressLine2: optionalText(z.string().max(200)),
  billingCity: optionalText(z.string().max(100)),
  billingState: optionalText(z.string().length(2)),
  billingZip: optionalText(z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code")),
  preferredContact: z.preprocess(value => value === "" ? null : value, z.enum(["email", "phone", "text"]).optional().nullable()),
  customerSource: optionalText(z.string().max(100)),
  taxExempt: z.boolean().default(false),
  taxExemptionId: optionalText(z.string().max(100)),
  internalNotes: optionalText(z.string().max(5000)),
  tags: z.array(z.string()).default([]),
  portalAccess: z.boolean().default(false),
});

export const propertySchema = z.object({
  customerId: z.string().uuid("Invalid customer"),
  propertyName: z.string().max(200).optional().nullable(),
  addressLine1: z.string().min(1, "Address is required").max(200),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().length(2, "State must be 2 characters"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  propertyType: z.enum(["residential", "commercial"]),
  residentialType: z.string().max(100).optional().nullable(),
  lotSizeSqft: z.number().positive().optional().nullable(),
  turfAreaSqft: z.number().positive().optional().nullable(),
  bedAreaSqft: z.number().positive().optional().nullable(),
  sidewalkAreaSqft: z.number().positive().optional().nullable(),
  parkingAreaSqft: z.number().positive().optional().nullable(),
  drivewayAreaSqft: z.number().positive().optional().nullable(),
  snowServiceAreaSqft: z.number().positive().optional().nullable(),
  saltTreatmentAreaSqft: z.number().positive().optional().nullable(),
  accessInstructions: z.string().max(2000).optional().nullable(),
  gateCode: z.string().max(100).optional().nullable(),
  waterAccessNotes: z.string().max(1000).optional().nullable(),
  irrigationNotes: z.string().max(1000).optional().nullable(),
  hazards: z.string().max(2000).optional().nullable(),
  petsOnProperty: z.boolean().default(false),
  utilityNotes: z.string().max(1000).optional().nullable(),
  preferredServiceDays: z.array(z.string()).default([]),
  serviceRestrictions: z.string().max(2000).optional().nullable(),
  propertyNotes: z.string().max(5000).optional().nullable(),
  active: z.boolean().default(true),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
}).refine((value) => (value.latitude == null) === (value.longitude == null), {
  message: "Latitude and longitude must be entered together",
  path: ["latitude"],
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type PropertyInput = z.infer<typeof propertySchema>;
