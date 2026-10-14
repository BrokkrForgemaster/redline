import { z } from "zod";

const safeSupportText = z.string().trim().min(1).max(4000).refine(value =>
  !/(?:sk_[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}\.|password\s*[:=]\s*\S+)/i.test(value),
  "Remove passwords or access tokens before sending support details."
);

export const createSupportSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  category: z.enum(["technical_issue", "access", "change_request", "other"]),
  affectedPage: z.string().trim().max(300).default(""),
  body: safeSupportText,
});

export const replySupportSchema = z.object({
  ticketId: z.uuid(),
  body: safeSupportText,
});

export const changeSupportStatusSchema = z.object({
  ticketId: z.uuid(),
  status: z.enum(["open", "triaged", "in_progress", "waiting_on_owner", "resolved", "closed"]),
});
