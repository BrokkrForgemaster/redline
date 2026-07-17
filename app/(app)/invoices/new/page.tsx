"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { z } from "zod";
import { createInvoice } from "@/lib/actions/invoices";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type CustomerRow = { id: string; first_name: string; last_name: string; business_name: string | null };

const invoiceItemSchema = z.object({
  sortOrder: z.number().int().min(0),
  name: z.string().min(1, "Item name is required").max(300),
  description: z.string().max(2000).optional().nullable(),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0),
  taxable: z.boolean().default(true),
});

const invoiceFormSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  propertyId: z.string().uuid().optional().nullable(),
  jobId: z.string().uuid().optional().nullable(),
  estimateId: z.string().uuid().optional().nullable(),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  paymentTerms: z.number().int().min(0).default(30),
  taxRate: z.number().min(0).max(100).default(0),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required"),
  customerNotes: z.string().max(5000).optional().nullable(),
  internalNotes: z.string().max(5000).optional().nullable(),
});

type InvoiceFormInput = z.infer<typeof invoiceFormSchema>;

const fieldClass =
  "block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";
const labelClass = "block text-sm font-medium text-charcoal mb-1";
const errorClass = "mt-1 text-xs text-red-600";

const today = new Date().toISOString().slice(0, 10);
const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId") ?? "";

  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("customers")
      .select("id, first_name, last_name, business_name")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("last_name")
      .then(({ data }) => {
        if (data) setCustomers(data);
      });
  }, []);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<InvoiceFormInput>({
    resolver: zodResolver(invoiceFormSchema) as any,
    defaultValues: {
      customerId: preselectedCustomerId,
      issueDate: today,
      dueDate: thirtyDays,
      paymentTerms: 30,
      taxRate: 0,
      items: [
        {
          sortOrder: 0,
          name: "",
          description: "",
          quantity: 1,
          unitPrice: 0,
          taxable: true,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const watchedItems = useWatch({ control, name: "items" }) ?? [];
  const watchedTaxRate = useWatch({ control, name: "taxRate" }) ?? 0;

  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0),
    0
  );
  const taxableSubtotal = watchedItems
    .filter((i) => i?.taxable)
    .reduce((sum, i) => sum + (Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0), 0);
  const taxAmount = taxableSubtotal * (Number(watchedTaxRate) / 100);
  const total = subtotal + taxAmount;

  async function onSubmit(data: InvoiceFormInput) {
    const result = await createInvoice(data);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice created");
    router.push(`/invoices/${result.id}`);
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">New Invoice</h1>
        <p className="text-sm text-muted mt-1">Fill in the details below to create an invoice.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Info */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-charcoal">Invoice Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Customer <span className="text-redline">*</span>
              </label>
              <select {...register("customerId")} className={fieldClass}>
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                    {c.business_name ? ` — ${c.business_name}` : ""}
                  </option>
                ))}
              </select>
              {errors.customerId && <p className={errorClass}>{errors.customerId.message}</p>}
            </div>

            <div>
              <label className={labelClass}>Payment Terms (days)</label>
              <input
                type="number"
                min="0"
                {...register("paymentTerms", { valueAsNumber: true })}
                className={fieldClass}
                placeholder="30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Issue Date <span className="text-redline">*</span>
              </label>
              <input type="date" {...register("issueDate")} className={fieldClass} />
              {errors.issueDate && <p className={errorClass}>{errors.issueDate.message}</p>}
            </div>
            <div>
              <label className={labelClass}>
                Due Date <span className="text-redline">*</span>
              </label>
              <input type="date" {...register("dueDate")} className={fieldClass} />
              {errors.dueDate && <p className={errorClass}>{errors.dueDate.message}</p>}
            </div>
          </div>
        </section>

        {/* Line Items */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-charcoal">Line Items</h2>
            <button
              type="button"
              onClick={() =>
                append({
                  sortOrder: fields.length,
                  name: "",
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                  taxable: true,
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-redline text-white rounded-lg hover:bg-redline-dark transition-colors"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          {errors.items && !Array.isArray(errors.items) && (
            <p className={errorClass}>{errors.items.message}</p>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => {
              const qty = Number(watchedItems[index]?.quantity) || 0;
              const price = Number(watchedItems[index]?.unitPrice) || 0;
              const lineTotal = qty * price;
              return (
                <div
                  key={field.id}
                  className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <label className={labelClass}>
                        Name <span className="text-redline">*</span>
                      </label>
                      <input
                        {...register(`items.${index}.name`)}
                        className={fieldClass}
                        placeholder="Item name"
                      />
                      {errors.items?.[index]?.name && (
                        <p className={errorClass}>{errors.items[index]?.name?.message}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="mt-6 p-1.5 text-muted hover:text-redline transition-colors flex-shrink-0"
                      title="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div>
                    <label className={labelClass}>Description</label>
                    <input
                      {...register(`items.${index}.description`)}
                      className={fieldClass}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className={labelClass}>Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Unit Price</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                        className={fieldClass}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id={`taxable-${index}`}
                        {...register(`items.${index}.taxable`)}
                        className="h-4 w-4 rounded text-redline focus:ring-redline"
                      />
                      <label htmlFor={`taxable-${index}`} className="text-sm text-charcoal cursor-pointer">
                        Taxable
                      </label>
                    </div>
                    <div className="text-right pt-5">
                      <p className="text-xs text-muted">Subtotal</p>
                      <p className="font-semibold text-charcoal">{fmt(lineTotal)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pricing */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-charcoal">Tax & Totals</h2>

          <div className="max-w-xs">
            <label className={labelClass}>Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              {...register("taxRate", { valueAsNumber: true })}
              className={fieldClass}
              placeholder="0.00"
            />
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="font-medium">{fmt(subtotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Tax ({watchedTaxRate}%)</span>
                <span className="font-medium">{fmt(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2">
              <span className="text-charcoal">Total</span>
              <span className="text-charcoal">{fmt(total)}</span>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-charcoal">Notes</h2>
          <div>
            <label className={labelClass}>Customer Notes</label>
            <textarea
              {...register("customerNotes")}
              rows={3}
              className={`${fieldClass} resize-y`}
              placeholder="Notes visible to the customer…"
            />
          </div>
          <div>
            <label className={labelClass}>Internal Notes</label>
            <textarea
              {...register("internalNotes")}
              rows={3}
              className={`${fieldClass} resize-y`}
              placeholder="Internal notes (not visible to customer)…"
            />
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3 pb-10">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {isSubmitting ? "Creating…" : "Create Invoice"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
