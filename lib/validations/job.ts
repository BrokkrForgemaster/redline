import { z } from "zod";

export const jobSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  propertyId: z.string().uuid().optional().nullable(),
  estimateId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  serviceType: z.string().min(1, "Service type is required").max(200),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(5000).optional().nullable(),
  crewId: z.string().uuid().optional().nullable(),
  scheduledDate: z.string().date().optional().nullable(),
  scheduledStart: z.string().optional().nullable(),
  scheduledEnd: z.string().optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  workInstructions: z.string().max(5000).optional().nullable(),
  accessNotes: z.string().max(2000).optional().nullable(),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().max(500).optional().nullable(),
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
