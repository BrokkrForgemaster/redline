"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { estimateSchema, type EstimateInput } from "@/lib/validations/estimate";
import { createEstimate } from "@/lib/actions/estimates";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

// Metadata cannot be in a client file; it's set by the layout.
// This page is entirely client-rendered.

type CustomerRow = { id: string; first_name: string; last_name: string; business_name: string | null };

const fieldClass =
  "block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";
const labelClass = "block text-sm font-medium text-charcoal mb-1";
const errorClass = "mt-1 text-xs text-red-600";

const ITEM_TYPES = [
  "service",
  "material",
  "labor",
  "equipment",
  "subcontractor",
  "fee",
  "discount",
] as const;

const today = new Date().toISOString().slice(0, 10);

export default function NewEstimatePage() {
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
  } = useForm<EstimateInput>({
    resolver: zodResolver(estimateSchema) as any,
    defaultValues: {
      customerId: preselectedCustomerId,
      issueDate: today,
      discountValue: 0,
      taxRate: 0,
      depositPercent: 0,
      items: [
        {
          sortOrder: 0,
          itemType: "service",
          name: "",
          description: "",
          quantity: 1,
          unit: "",
          unitPrice: 0,
          taxable: true,
          productId: null,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const watchedItems = useWatch({ control, name: "items" }) ?? [];
  const watchedDiscountType = useWatch({ control, name: "discountType" });
  const watchedDiscountValue = useWatch({ control, name: "discountValue" }) ?? 0;
  const watchedTaxRate = useWatch({ control, name: "taxRate" }) ?? 0;
  const watchedDepositPercent = useWatch({ control, name: "depositPercent" }) ?? 0;

  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0),
    0
  );
  const discountAmount =
    watchedDiscountType === "percent"
      ? subtotal * (Number(watchedDiscountValue) / 100)
      : watchedDiscountType === "fixed"
      ? Number(watchedDiscountValue)
      : 0;
  const taxableSubtotal =
    watchedItems
      .filter((i) => i?.taxable)
      .reduce((sum, i) => sum + (Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0), 0) -
    discountAmount;
  const taxAmount = Math.max(0, taxableSubtotal) * (Number(watchedTaxRate) / 100);
  const total = subtotal - discountAmount + taxAmount;
  const depositAmount = total * (Number(watchedDepositPercent) / 100);

  async function onSubmit(data: EstimateInput) {
    const result = await createEstimate(data);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Estimate created");
    router.push(`/estimates/${result.id}`);
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">New Estimate</h1>
        <p className="text-sm text-muted mt-1">Fill in the details below to create an estimate.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Info */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-charcoal">Estimate Details</h2>

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
              <label className={labelClass}>
                Title <span className="text-redline">*</span>
              </label>
              <input
                {...register("title")}
                className={fieldClass}
                placeholder="e.g. Spring Lawn Care Package"
              />
              {errors.title && <p className={errorClass}>{errors.title.message}</p>}
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
              <label className={labelClass}>Expiration Date</label>
              <input type="date" {...register("expirationDate")} className={fieldClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              {...register("description")}
              rows={3}
              className={`${fieldClass} resize-y`}
              placeholder="Brief description of the work to be done…"
            />
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
                  itemType: "service",
                  name: "",
                  description: "",
                  quantity: 1,
                  unit: "",
                  unitPrice: 0,
                  taxable: true,
                  productId: null,
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                      <div>
                        <label className={labelClass}>Type</label>
                        <select
                          {...register(`items.${index}.itemType`)}
                          className={fieldClass}
                        >
                          {ITEM_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-1 sm:col-span-3">
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

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
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
                      <label className={labelClass}>Unit</label>
                      <input
                        {...register(`items.${index}.unit`)}
                        className={fieldClass}
                        placeholder="each, hr…"
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
          <h2 className="text-base font-semibold text-charcoal">Pricing & Terms</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
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
            <div>
              <label className={labelClass}>Discount Type</label>
              <select {...register("discountType")} className={fieldClass}>
                <option value="">None</option>
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Discount Value</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register("discountValue", { valueAsNumber: true })}
                className={fieldClass}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Deposit Required (%)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                {...register("depositPercent", { valueAsNumber: true })}
                className={fieldClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Payment Terms</label>
              <input
                {...register("paymentTerms")}
                className={fieldClass}
                placeholder="e.g. Net 30, Due on receipt"
              />
            </div>
          </div>

          {/* Live Totals */}
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="text-charcoal font-medium">{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Discount</span>
                <span className="text-lawn font-medium">-{fmt(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Tax ({watchedTaxRate}%)</span>
                <span className="text-charcoal font-medium">{fmt(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2">
              <span className="text-charcoal">Total</span>
              <span className="text-charcoal">{fmt(total)}</span>
            </div>
            {depositAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Deposit Required ({watchedDepositPercent}%)</span>
                <span className="text-charcoal font-medium">{fmt(depositAmount)}</span>
              </div>
            )}
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
              placeholder="Notes visible to the customer on the estimate…"
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
            {isSubmitting ? "Creating…" : "Create Estimate"}
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
