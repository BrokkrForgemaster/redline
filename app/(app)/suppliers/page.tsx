import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Store } from "lucide-react";
import { formatPhone } from "@/lib/utils/format";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const supabase = await createClient();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, company_name, contact_name, email, phone, active")
    .eq("active", true)
    .order("company_name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Suppliers</h1>
          <p className="text-sm text-muted">{suppliers?.length ?? 0} active suppliers</p>
        </div>
        <Link
          href="/suppliers/new"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Plus size={16} />
          New Supplier
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!suppliers || suppliers.length === 0 ? (
          <div className="py-16 text-center">
            <Store size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No suppliers yet</p>
            <p className="text-sm text-muted mt-1">
              Add your first supplier to track vendors and orders
            </p>
            <Link
              href="/suppliers/new"
              className="mt-4 inline-block text-sm text-redline hover:underline"
            >
              Add Supplier
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Company
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                    Contact
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Email
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/suppliers/${supplier.id}`}
                        className="font-medium text-charcoal hover:text-redline"
                      >
                        {supplier.company_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted hidden md:table-cell">
                      {supplier.contact_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-muted hidden sm:table-cell">
                      {supplier.email ? (
                        <a
                          href={`mailto:${supplier.email}`}
                          className="hover:text-redline transition-colors"
                        >
                          {supplier.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted hidden lg:table-cell">
                      {formatPhone(supplier.phone)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
