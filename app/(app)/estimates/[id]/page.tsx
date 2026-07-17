"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Edit, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import StatusBadge, { estimateStatusBadge } from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { updateEstimateStatus } from "@/lib/actions/estimates";

type EstimateItem = {
  id: string;
  sort_order: number;
  item_type: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total: number;
  taxable: boolean;
};

type Estimate = {
  id: string;
  estimate_number: string;
  title: string;
  status: string;
  description: string | null;
  issue_date: string;
  expiration_date: string | null;
  subtotal: number;
  discount_type: string | null;
  discount_value: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  deposit_percent: number;
  deposit_amount: number;
  deposit_paid: number;
  payment_terms: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  customers: {
    id: string;
    first_name: string;
    last_name: string;
    business_name: string | null;
  } | null;
  properties: {
    id: string;
    address_line1: string;
    city: string;
    state: string;
    zip: string;
  } | null;
  estimate_items: EstimateItem[];
};

function StatusActions({
  estimate,
  onStatusChange,
}: {
  estimate: Estimate;
  onStatusChange: (status: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function act(status: string) {
    startTransition(async () => {
      const result = await updateEstimateStatus(
        estimate.id,
        status as Parameters<typeof updateEstimateStatus>[1]
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Estimate marked as ${status.replace(/_/g, " ")}`);
        onStatusChange(status);
      }
    });
  }

  const actions: { label: string; status: string; icon: React.ReactNode; variant: "primary" | "secondary" | "danger" }[] = [];

  if (estimate.status === "draft" || estimate.status === "ready_for_review") {
    actions.push({ label: "Mark Sent", status: "sent", icon: <Send size={14} />, variant: "primary" });
  }
  if (estimate.status === "sent" || estimate.status === "viewed") {
    actions.push({ label: "Mark Approved", status: "approved", icon: <CheckCircle size={14} />, variant: "primary" });
    actions.push({ label: "Mark Declined", status: "declined", icon: <XCircle size={14} />, variant: "danger" });
  }
  if (!["voided", "converted", "expired"].includes(estimate.status)) {
    actions.push({ label: "Void", status: "voided", icon: <XCircle size={14} />, variant: "danger" });
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
            a.variant === "primary"
              ? "flex items-center gap-1.5 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
              : a.variant === "danger"
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

export default function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null | "not-found">(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("estimates")
      .select(
        `id, estimate_number, title, status, description,
         issue_date, expiration_date, subtotal, discount_type, discount_value,
         discount_amount, tax_rate, tax_amount, total, deposit_percent, deposit_amount,
         deposit_paid, payment_terms, customer_notes, internal_notes,
         customers(id, first_name, last_name, business_name),
         properties(id, address_line1, city, state, zip),
         estimate_items(id, sort_order, item_type, name, description, quantity, unit, unit_price, total, taxable)`
      )
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setEstimate("not-found");
          return;
        }
        setEstimate(data as unknown as Estimate);
      });
  }, [id]);

  if (estimate === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  if (estimate === "not-found") {
    router.push("/estimates");
    return null;
  }

  const badge = estimateStatusBadge(estimate.status);
  const customer = estimate.customers;
  const property = estimate.properties;
  const items = [...(estimate.estimate_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  function handleStatusChange(newStatus: string) {
    if (estimate && estimate !== "not-found") {
      setEstimate({ ...estimate, status: newStatus });
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/estimates" className="text-sm text-muted hover:text-charcoal">
          Estimates
        </Link>
        <ChevronRight size={14} className="text-muted" />
        <span className="text-sm text-charcoal font-medium">{estimate.estimate_number}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-charcoal">
              {estimate.estimate_number}
              {estimate.title ? ` — ${estimate.title}` : ""}
            </h1>
            <StatusBadge label={badge.label} variant={badge.variant} />
          </div>
          {customer && (
            <p className="text-muted mt-1">
              {customer.first_name} {customer.last_name}
              {customer.business_name ? ` · ${customer.business_name}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 items-start sm:items-end">
          <Link
            href={`/estimates/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit size={15} /> Edit
          </Link>
          <StatusActions estimate={estimate} onStatusChange={handleStatusChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer & Details Card */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-charcoal">Customer</h2>
            {customer ? (
              <div className="space-y-1">
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
            ) : (
              <p className="text-sm text-muted">No customer</p>
            )}

            {property && (
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">Property</p>
                <p className="text-sm text-charcoal">{property.address_line1}</p>
                <p className="text-sm text-charcoal">
                  {property.city}, {property.state} {property.zip}
                </p>
              </div>
            )}

            <div className="space-y-2 border-t border-gray-100 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Issue Date</span>
                <span className="text-charcoal">{formatDate(estimate.issue_date)}</span>
              </div>
              {estimate.expiration_date && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Expires</span>
                  <span className="text-charcoal">{formatDate(estimate.expiration_date)}</span>
                </div>
              )}
              {estimate.payment_terms && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Terms</span>
                  <span className="text-charcoal">{estimate.payment_terms}</span>
                </div>
              )}
            </div>
          </div>

          {/* Totals Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h2 className="font-semibold text-charcoal mb-3">Summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatCurrency(estimate.subtotal)}</span>
            </div>
            {estimate.discount_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">
                  Discount
                  {estimate.discount_type === "percent"
                    ? ` (${estimate.discount_value}%)`
                    : ""}
                </span>
                <span className="text-lawn">-{formatCurrency(estimate.discount_amount)}</span>
              </div>
            )}
            {estimate.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Tax ({estimate.tax_rate}%)</span>
                <span>{formatCurrency(estimate.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2">
              <span className="text-charcoal">Total</span>
              <span className="text-charcoal">{formatCurrency(estimate.total)}</span>
            </div>
            {estimate.deposit_amount > 0 && (
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                <span className="text-muted">Deposit ({estimate.deposit_percent}%)</span>
                <span className="text-charcoal font-medium">
                  {formatCurrency(estimate.deposit_amount)}
                </span>
              </div>
            )}
            {estimate.deposit_paid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Deposit Paid</span>
                <span className="text-lawn font-medium">
                  {formatCurrency(estimate.deposit_paid)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="lg:col-span-2 space-y-4">
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
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">
                    Type
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
                    <td className="px-5 py-3 text-muted capitalize hidden sm:table-cell">
                      {item.item_type}
                    </td>
                    <td className="px-5 py-3 text-right text-charcoal">
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ""}
                    </td>
                    <td className="px-5 py-3 text-right text-charcoal hidden md:table-cell">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-5 py-3 text-center hidden lg:table-cell">
                      <span
                        className={`text-xs ${item.taxable ? "text-lawn" : "text-muted"}`}
                      >
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

          {/* Notes */}
          {(estimate.customer_notes || estimate.internal_notes) && (
            <div className="space-y-4">
              {estimate.customer_notes && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="font-semibold text-charcoal mb-2">Customer Notes</h2>
                  <p className="text-sm text-charcoal whitespace-pre-line">
                    {estimate.customer_notes}
                  </p>
                </div>
              )}
              {estimate.internal_notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-yellow-800 mb-2">Internal Notes</h2>
                  <p className="text-sm text-yellow-700 whitespace-pre-line">
                    {estimate.internal_notes}
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
