import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import { DollarSign } from "lucide-react";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("payments")
    .select(
      `id, amount, payment_method, reference_number, payment_date, notes, created_at,
       customers(id, first_name, last_name, business_name),
       invoices(id, invoice_number)`,
      { count: "exact" }
    )
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter === "this_month") {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    query = query.gte("payment_date", firstDay).lte("payment_date", lastDay);
  }

  const { data: payments, count } = await query;

  const total = count ?? 0;
  const totalAmount =
    payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;

  const methodLabel = (m: string) =>
    m
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const filters = [
    { value: "all", label: "All Time" },
    { value: "this_month", label: "This Month" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Payments</h1>
          <p className="text-sm text-muted">{total} payment{total !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          {filters.map((f) => (
            <Link
              key={f.value}
              href={`/payments?filter=${f.value}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f.value
                  ? "bg-charcoal text-white"
                  : "bg-gray-100 text-muted hover:bg-gray-200"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        {payments && payments.length > 0 && (
          <p className="text-sm font-semibold text-charcoal">
            Total: {formatCurrency(totalAmount)}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!payments || payments.length === 0 ? (
          <div className="py-16 text-center">
            <DollarSign size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No payments found</p>
            <p className="text-sm text-muted mt-1">
              Payments are recorded from the invoice detail page.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">
                  Date
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">
                  Customer
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">
                  Invoice #
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden lg:table-cell">
                  Method
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden lg:table-cell">
                  Reference
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((payment) => {
                const customer = payment.customers as {
                  id: string;
                  first_name: string;
                  last_name: string;
                  business_name: string | null;
                } | null;
                const invoice = payment.invoices as {
                  id: string;
                  invoice_number: string;
                } | null;

                return (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-charcoal">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      {customer ? (
                        <Link
                          href={`/customers/${customer.id}`}
                          className="text-charcoal hover:text-redline font-medium"
                        >
                          {customer.first_name} {customer.last_name}
                          {customer.business_name && (
                            <span className="block text-xs font-normal text-muted">
                              {customer.business_name}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      {invoice ? (
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="text-charcoal hover:text-redline font-medium"
                        >
                          {invoice.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted hidden lg:table-cell">
                      {methodLabel(payment.payment_method)}
                    </td>
                    <td className="px-5 py-3 text-muted hidden lg:table-cell">
                      {payment.reference_number ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-lawn">
                      {formatCurrency(payment.amount)}
                    </td>
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
