import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate, formatPhone } from "@/lib/utils/format";
import { Plus, Search, Users } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

export const metadata = { title: "Customers" };

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, status = "active", page = "1" } = await searchParams;
  const supabase = await createClient();
  const pageSize = 25;
  const offset = (parseInt(page) - 1) * pageSize;

  let query = supabase
    .from("customers")
    .select("id, account_type, first_name, last_name, business_name, email, mobile_phone, status, created_at", { count: "exact" })
    .is("deleted_at", null)
    .order("last_name");

  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,business_name.ilike.%${q}%,email.ilike.%${q}%`);
  query = query.range(offset, offset + pageSize - 1);

  const { data: customers, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Customers</h1>
          <p className="text-sm text-muted">{total} total</p>
        </div>
        <Link
          href="/customers/new"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Plus size={16} />
          New Customer
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <form>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name, email, or phone…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none"
            />
          </form>
        </div>
        <div className="flex gap-2">
          {["active", "inactive", "archived", "all"].map(s => (
            <Link
              key={s}
              href={`/customers?status=${s}${q ? `&q=${q}` : ""}`}
              className={`px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors ${
                status === s
                  ? "bg-charcoal text-white"
                  : "bg-gray-50 text-muted hover:bg-gray-100"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {(!customers || customers.length === 0) ? (
          <div className="py-16 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No customers found</p>
            <p className="text-sm text-muted mt-1">
              {q ? `No results for "${q}"` : "Add your first customer to get started"}
            </p>
            <Link href="/customers/new" className="mt-4 inline-block text-sm text-redline hover:underline">
              Add Customer
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">Phone</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/customers/${customer.id}`} className="block">
                        <p className="font-medium text-charcoal hover:text-redline transition-colors">
                          {customer.first_name} {customer.last_name}
                        </p>
                        {customer.business_name && (
                          <p className="text-xs text-muted">{customer.business_name}</p>
                        )}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted hidden md:table-cell">{customer.email}</td>
                    <td className="px-5 py-3 text-muted hidden lg:table-cell">
                      {formatPhone(customer.mobile_phone)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge
                        label={customer.status}
                        variant={customer.status === "active" ? "green" : customer.status === "inactive" ? "yellow" : "gray"}
                      />
                    </td>
                    <td className="px-5 py-3 text-muted hidden lg:table-cell">
                      {formatDate(customer.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-100 px-5 py-4 flex items-center justify-between text-sm">
            <p className="text-muted">
              Showing {offset + 1}–{Math.min(offset + pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              {parseInt(page) > 1 && (
                <Link href={`/customers?status=${status}&page=${parseInt(page) - 1}${q ? `&q=${q}` : ""}`}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                  Previous
                </Link>
              )}
              {parseInt(page) < totalPages && (
                <Link href={`/customers?status=${status}&page=${parseInt(page) + 1}${q ? `&q=${q}` : ""}`}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
