import { z } from "zod";

export const customerSchema = z.object({
  accountType: z.enum(["individual", "business"]),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  businessName: z.string().max(200).optional().nullable(),
  primaryContact: z.string().max(100).optional().nullable(),
  email: z.string().email("Please enter a valid email address"),
  mobilePhone: z
    .string()
    .regex(/^[\d\s\-\(\)\+\.]+$/, "Please enter a valid phone number")
    .optional()
    .nullable(),
  alternatePhone: z
    .string()
    .regex(/^[\d\s\-\(\)\+\.]+$/, "Please enter a valid phone number")
    .optional()
    .nullable(),
  billingAddressLine1: z.string().max(200).optional().nullable(),
  billingAddressLine2: z.string().max(200).optional().nullable(),
  billingCity: z.string().max(100).optional().nullable(),
  billingState: z.string().length(2).optional().nullable(),
  billingZip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code").optional().nullable(),
  preferredContact: z.enum(["email", "phone", "text"]).optional().nullable(),
  customerSource: z.string().max(100).optional().nullable(),
  taxExempt: z.boolean().default(false),
  taxExemptionId: z.string().max(100).optional().nullable(),
  internalNotes: z.string().max(5000).optional().nullable(),
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
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type PropertyInput = z.infer<typeof propertySchema>;
