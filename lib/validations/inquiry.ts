import { z } from "zod";

export const quoteInquirySchema = z.object({
  submissionId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().max(254),
  phone: z.string().trim().max(40).default(""),
  service: z.enum(["", "Lawn Mowing", "Landscaping", "Aeration & Overseeding", "Snow Removal", "Other"]),
  message: z.string().trim().min(10).max(4000),
  companyWebsite: z.string().max(200).default(""),
});

export type QuoteInquiry = z.infer<typeof quoteInquirySchema>;
