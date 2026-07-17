"use client";

import { useEffect, useState, useTransition } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, Send, CheckCircle, XCircle, DollarSign, Loader2 } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import StatusBadge, { invoiceStatusBadge } from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { updateInvoiceStatus, recordPayment } from "@/lib/actions/invoices";

type InvoiceItem = {
  id: string;
  sort_order: number;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  taxable: boolean;
};

type Payment = {
  id: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  payment_date: string;
  notes: string | null;
  created_at: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  payment_terms: number;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  customer_notes: string | null;
  internal_notes: string | null;
  customers: {
    id: string;
    first_name: string;
    last_name: string;
    business_name: string | null;
  } | null;
  invoice_items: InvoiceItem[];
  payments: Payment[];
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "credit_card", label: "Credit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "venmo", label: "Venmo" },
  { value: "other", label: "Other" },
];

const paymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  referenceNumber: z.string().optional(),
  paymentDate: z.string().date(),
  notes: z.string().optional(),
});

type PaymentFormInput = z.infer<typeof paymentSchema>;

const fieldClass =
  "block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";
const labelClass = "block text-sm font-medium text-charcoal mb-1";
const errorClass = "mt-1 text-xs text-red-600";

function RecordPaymentForm({
  invoiceId,
  balanceDue,
  onSuccess,
}: {
  invoiceId: string;
  balanceDue: number;
  onSuccess: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: balanceDue > 0 ? balanceDue : undefined,
      paymentMethod: "check",
      paymentDate: today,
    },
  });

  async function onSubmit(data: PaymentFormInput) {
    const result = await recordPayment(
      invoiceId,
      data.amount,
      data.paymentMethod,
      data.referenceNumber ?? null,
      data.paymentDate,
      data.notes ?? null
    );
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Payment recorded");
    reset();
    setIsOpen(false);
    onSuccess();
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
      >
        <DollarSign size={15} /> Record Payment
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-charcoal">Record Payment</h2>
        <button
          onClick={() => setIsOpen(false)}
          className="text-sm text-muted hover:text-charcoal"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Amount <span className="text-redline">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...register("amount", { valueAsNumber: true })}
              className={fieldClass}
              placeholder="0.00"
            />
            {errors.amount && <p className={errorClass}>{errors.amount.message}</p>}
          </div>
          <div>
            <label className={labelClass}>
              Payment Method <span className="text-redline">*</span>
            </label>
            <select {...register("paymentMethod")} className={fieldClass}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {errors.paymentMethod && <p className={errorClass}>{errors.paymentMethod.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Payment Date <span className="text-redline">*</span>
            </label>
            <input type="date" {...register("paymentDate")} className={fieldClass} />
            {errors.paymentDate && <p className={errorClass}>{errors.paymentDate.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Reference # / Check #</label>
            <input
              {...register("referenceNumber")}
              className={fieldClass}
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <input {...register("notes")} className={fieldClass} placeholder="Optional notes" />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {isSubmitting ? "Saving…" : "Save Payment"}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-5 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function InvoiceStatusActions({
  invoice,
  onStatusChange,
}: {
  invoice: Invoice;
  onStatusChange: (status: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function act(status: string) {
    startTransition(async () => {
      const result = await updateInvoiceStatus(
        invoice.id,
        status as Parameters<typeof updateInvoiceStatus>[1]
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Invoice marked as ${status.replace(/_/g, " ")}`);
        onStatusChange(status);
      }
    });
  }

  const actions: { label: string; status: string; icon: React.ReactNode }[] = [];

  if (invoice.status === "draft") {
    actions.push({ label: "Mark Issued", status: "issued", icon: <CheckCircle size={14} /> });
    actions.push({ label: "Mark Sent", status: "sent", icon: <Send size={14} /> });
  }
  if (invoice.status === "issued") {
    actions.push({ label: "Mark Sent", status: "sent", icon: <Send size={14} /> });
  }
  if (!["paid", "voided", "written_off"].includes(invoice.status)) {
    actions.push({ label: "Void", status: "voided", icon: <XCircle size={14} /> });
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {actions.map((a) => (
        <button
          key={a.status}
          onClick={() => act(a.status)}
          disabled={isPending}
          className={
            a.status === "voided"
              ? "flex items-center gap-1.5 border border-red-200 text-red-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
              : "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
          }
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : a.icon}
          {a.label}
        </button>
      ))}
    </div>
  );
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null | "not-found">(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("invoices")
      .select(
        `id, invoice_number, status, issue_date, due_date, payment_terms,
         subtotal, discount_amount, tax_rate, tax_amount, total, amount_paid, balance_due,
         customer_notes, internal_notes,
         customers(id, first_name, last_name, business_name),
         invoice_items(id, sort_order, name, description, quantity, unit_price, total, taxable),
         payments(id, amount, payment_method, reference_number, payment_date, notes, created_at)`
      )
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setInvoice("not-found");
          return;
        }
        setInvoice(data as unknown as Invoice);
      });
  }, [id, refreshKey]);

  if (invoice === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  if (invoice === "not-found") {
    router.push("/invoices");
    return null;
  }

  const badge = invoiceStatusBadge(invoice.status);
  const customer = invoice.customers;
  const items = [...(invoice.invoice_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const payments = [...(invoice.payments ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  function handleStatusChange(newStatus: string) {
    setInvoice((prev) => (prev && prev !== "not-found" ? { ...prev, status: newStatus } : prev));
  }

  const methodLabel = (m: string) =>
    m
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/invoices" className="text-sm text-muted hover:text-charcoal">
          Invoices
        </Link>
        <ChevronRight size={14} className="text-muted" />
        <span className="text-sm text-charcoal font-medium">{invoice.invoice_number}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-charcoal">{invoice.invoice_number}</h1>
            <StatusBadge label={badge.label} variant={badge.variant} />
          </div>
          {customer && (
            <p className="text-muted mt-1">
              {customer.first_name} {customer.last_name}
              {customer.business_name ? ` · ${customer.business_name}` : ""}
            </p>
          )}
        </div>
        <InvoiceStatusActions invoice={invoice} onStatusChange={handleStatusChange} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Customer & Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-charcoal">Details</h2>

            {customer && (
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">Customer</p>
                <Link
                  href={`/customers/${customer.id}`}
                  className="text-sm font-medium text-charcoal hover:text-redline"
                >
                  {customer.first_name} {customer.last_name}
                </Link>
                {customer.business_name && (
                  <p className="text-xs text-muted">{customer.business_name}</p>
                )}
              </div>
            )}

            <div className="space-y-2 border-t border-gray-100 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Issue Date</span>
                <span>{formatDate(invoice.issue_date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Due Date</span>
                <span>{formatDate(invoice.due_date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Terms</span>
                <span>Net {invoice.payment_terms}</span>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h2 className="font-semibold text-charcoal mb-3">Summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Discount</span>
                <span className="text-lawn">-{formatCurrency(invoice.discount_amount)}</span>
              </div>
            )}
            {invoice.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Tax ({invoice.tax_rate}%)</span>
                <span>{formatCurrency(invoice.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2">
              <span className="text-charcoal">Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Amount Paid</span>
                <span className="text-lawn font-medium">{formatCurrency(invoice.amount_paid)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-2">
              <span className={invoice.balance_due > 0 ? "text-redline" : "text-charcoal"}>
                Balance Due
              </span>
              <span className={invoice.balance_due > 0 ? "text-redline" : "text-lawn"}>
                {formatCurrency(invoice.balance_due)}
              </span>
            </div>
          </div>

          {/* Record Payment */}
          {!["paid", "voided", "written_off"].includes(invoice.status) && (
            <RecordPaymentForm
              invoiceId={invoice.id}
              balanceDue={invoice.balance_due}
              onSuccess={() => setRefreshKey((k) => k + 1)}
            />
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Line Items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-charcoal">Line Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">
                    Name
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">
                    Qty
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">
                    Unit Price
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-muted uppercase hidden lg:table-cell">
                    Tax
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-charcoal">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted mt-0.5">{item.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">{item.quantity}</td>
                    <td className="px-5 py-3 text-right hidden md:table-cell">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-5 py-3 text-center hidden lg:table-cell">
                      <span className={`text-xs ${item.taxable ? "text-lawn" : "text-muted"}`}>
                        {item.taxable ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-charcoal">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payments History */}
          {payments.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-charcoal">Payment History</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">
                      Date
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">
                      Method
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">
                      Reference
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-charcoal">{formatDate(payment.payment_date)}</td>
                      <td className="px-5 py-3 text-muted hidden sm:table-cell">
                        {methodLabel(payment.payment_method)}
                      </td>
                      <td className="px-5 py-3 text-muted hidden md:table-cell">
                        {payment.reference_number ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-lawn">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          {(invoice.customer_notes || invoice.internal_notes) && (
            <div className="space-y-4">
              {invoice.customer_notes && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="font-semibold text-charcoal mb-2">Customer Notes</h2>
                  <p className="text-sm text-charcoal whitespace-pre-line">
                    {invoice.customer_notes}
                  </p>
                </div>
              )}
              {invoice.internal_notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-yellow-800 mb-2">Internal Notes</h2>
                  <p className="text-sm text-yellow-700 whitespace-pre-line">
                    {invoice.internal_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
