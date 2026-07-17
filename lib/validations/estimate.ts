import { z } from "zod";

export const estimateItemSchema = z.object({
  sortOrder: z.number().int().min(0),
  itemType: z.enum(["service", "material", "labor", "equipment", "subcontractor", "fee", "discount"]),
  name: z.string().min(1, "Item name is required").max(300),
  description: z.string().max(2000).optional().nullable(),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().max(50).optional().nullable(),
  unitPrice: z.number().min(0, "Unit price must be zero or positive"),
  taxable: z.boolean().default(true),
  productId: z.string().uuid().optional().nullable(),
});

export const estimateSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  propertyId: z.string().uuid().optional().nullable(),
  estimatorId: z.string().uuid().optional().nullable(),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(5000).optional().nullable(),
  issueDate: z.string().date(),
  expirationDate: z.string().date().optional().nullable(),
  discountType: z.enum(["percent", "fixed"]).optional().nullable(),
  discountValue: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  depositPercent: z.number().min(0).max(100).default(0),
  paymentTerms: z.string().max(500).optional().nullable(),
  customerNotes: z.string().max(5000).optional().nullable(),
  internalNotes: z.string().max(5000).optional().nullable(),
  items: z.array(estimateItemSchema).min(1, "At least one line item is required"),
});

export type EstimateInput = z.infer<typeof estimateSchema>;
export type EstimateItemInput = z.infer<typeof estimateItemSchema>;
