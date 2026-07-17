import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import StatusBadge, { estimateStatusBadge } from "@/components/ui/StatusBadge";
import { Plus, FileText } from "lucide-react";

export const metadata = { title: "Estimates" };

export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status = "all", q, page = "1" } = await searchParams;
  const supabase = await createClient();
  const pageSize = 25;
  const offset = (parseInt(page) - 1) * pageSize;

  let query = supabase
    .from("estimates")
    .select(`id, estimate_number, title, status, total, issue_date, expiration_date,
      customers(id, first_name, last_name, business_name)`, { count: "exact" })
    .order("created_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("title", `%${q}%`);
  query = query.range(offset, offset + pageSize - 1);

  const { data: estimates, count } = await query;
  const total = count ?? 0;

  const statuses = ["all", "draft", "sent", "approved", "declined", "expired", "converted"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Estimates</h1>
          <p className="text-sm text-muted">{total} total</p>
        </div>
        <Link href="/estimates/new" className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors">
          <Plus size={16} /> New Estimate
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-2">
        {statuses.map(s => (
          <Link key={s} href={`/estimates?status=${s}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${status === s ? "bg-charcoal text-white" : "bg-gray-100 text-muted hover:bg-gray-200"}`}>
            {s}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {(!estimates || estimates.length === 0) ? (
          <div className="py-16 text-center">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No estimates found</p>
            <Link href="/estimates/new" className="mt-4 inline-block text-sm text-redline hover:underline">Create your first estimate</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Number</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Customer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">Title</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Total</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {estimates.map(est => {
                const badge = estimateStatusBadge(est.status);
                const customer = est.customers as unknown as Record<string, unknown> | null;
                return (
                  <tr key={est.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/estimates/${est.id}`} className="font-medium text-charcoal hover:text-redline">{est.estimate_number}</Link>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {customer ? `${customer.first_name} ${customer.last_name}` : "—"}
                      {customer?.business_name ? <span className="block text-xs">{customer.business_name as string}</span> : null}
                    </td>
                    <td className="px-5 py-3 text-charcoal hidden md:table-cell">{est.title}</td>
                    <td className="px-5 py-3"><StatusBadge label={badge.label} variant={badge.variant} /></td>
                    <td className="px-5 py-3 text-right font-semibold">{formatCurrency(est.total)}</td>
                    <td className="px-5 py-3 text-muted hidden lg:table-cell">{formatDate(est.issue_date)}</td>
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
