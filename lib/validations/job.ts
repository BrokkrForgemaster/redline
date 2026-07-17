import { z } from "zod";

// HTML form controls emit "" when empty — coerce that to null so optional
// UUID and date fields don't fail Zod's format checks.
const e2n = (v: unknown) => (v === "" ? null : v);

export const jobSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  propertyId: z.preprocess(e2n, z.string().uuid().nullable().optional()),
  estimateId: z.preprocess(e2n, z.string().uuid().nullable().optional()),
  contractId: z.preprocess(e2n, z.string().uuid().nullable().optional()),
  serviceType: z.string().min(1, "Service type is required").max(200),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  title: z.string().min(1, "Title is required").max(300),
  description: z.preprocess(e2n, z.string().max(5000).nullable().optional()),
  crewId: z.preprocess(e2n, z.string().uuid().nullable().optional()),
  scheduledDate: z.preprocess(e2n, z.string().date().nullable().optional()),
  scheduledStart: z.preprocess(e2n, z.string().nullable().optional()),
  scheduledEnd: z.preprocess(e2n, z.string().nullable().optional()),
  estimatedHours: z.number().positive().optional().nullable(),
  workInstructions: z.preprocess(e2n, z.string().max(5000).nullable().optional()),
  accessNotes: z.preprocess(e2n, z.string().max(2000).nullable().optional()),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.preprocess(e2n, z.string().max(500).nullable().optional()),
});

export const timeEntrySchema = z.object({
  jobId: z.string().uuid().optional().nullable(),
  snowEventId: z.string().uuid().optional().nullable(),
  routeId: z.string().uuid().optional().nullable(),
  clockIn: z.string().datetime(),
  clockOut: z.string().datetime().optional().nullable(),
  breakMinutes: z.number().int().min(0).default(0),
  notes: z.string().max(2000).optional().nullable(),
});

export type JobInput = z.infer<typeof jobSchema>;
export type TimeEntryInput = z.infer<typeof timeEntrySchema>;
