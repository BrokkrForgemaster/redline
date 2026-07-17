import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import StatusBadge, { invoiceStatusBadge } from "@/components/ui/StatusBadge";
import { Plus, Receipt } from "lucide-react";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select(`id, invoice_number, status, total, balance_due, issue_date, due_date,
      customers(id, first_name, last_name, business_name)`, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);

  if (status !== "all") query = query.eq("status", status);

  const { data: invoices } = await query;

  const statuses = ["all", "draft", "issued", "sent", "partially_paid", "paid", "overdue", "voided"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Invoices</h1>
        <Link href="/invoices/new" className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors">
          <Plus size={16} /> New Invoice
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-2">
        {statuses.map(s => (
          <Link key={s} href={`/invoices?status=${s}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${status === s ? "bg-charcoal text-white" : "bg-gray-100 text-muted hover:bg-gray-200"}`}>
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {(!invoices || invoices.length === 0) ? (
          <div className="py-16 text-center">
            <Receipt size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No invoices found</p>
            <Link href="/invoices/new" className="mt-4 inline-block text-sm text-redline hover:underline">Create invoice</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Invoice #</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">Customer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">Total</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">Balance</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden lg:table-cell">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map(inv => {
                const badge = invoiceStatusBadge(inv.status);
                const customer = inv.customers as Record<string, unknown> | null;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-charcoal hover:text-redline">{inv.invoice_number}</Link>
                    </td>
                    <td className="px-5 py-3 text-muted hidden md:table-cell">
                      {customer ? `${customer.first_name} ${customer.last_name}` : "—"}
                    </td>
                    <td className="px-5 py-3"><StatusBadge label={badge.label} variant={badge.variant} /></td>
                    <td className="px-5 py-3 text-right font-semibold">{formatCurrency(inv.total)}</td>
                    <td className="px-5 py-3 text-right hidden sm:table-cell">
                      <span className={inv.balance_due > 0 ? "text-redline font-semibold" : "text-lawn"}>
                        {formatCurrency(inv.balance_due)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted hidden lg:table-cell">{formatDate(inv.due_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
