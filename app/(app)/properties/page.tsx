import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

export const metadata = { title: "Properties" };

interface SearchParams {
  type?: string;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { type } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("properties")
    .select(
      "id, property_name, address_line1, city, state, property_type, active, lot_size_sqft, created_at, customers!customer_id(first_name, last_name)"
    )
    .is("deleted_at", null)
    .order("city")
    .limit(100);

  if (type && type !== "all") {
    query = query.eq("property_type", type);
  }

  const { data: properties } = await query;

  const tabs = ["all", "residential", "commercial"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Properties</h1>
          <p className="text-sm text-muted">{properties?.length ?? 0} total</p>
        </div>
        <Link
          href="/properties/new"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Plus size={16} />
          New Property
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={tab === "all" ? "/properties" : `/properties?type=${tab}`}
            className={
              (type ?? "all") === tab
                ? "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors bg-charcoal text-white"
                : "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors bg-white border border-gray-200 text-muted hover:bg-gray-50"
            }
          >
            {tab}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!properties || properties.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No properties found</p>
            <p className="text-sm text-muted mt-1">
              {type && type !== "all"
                ? `No ${type} properties yet`
                : "Add your first property to get started"}
            </p>
            <Link
              href="/properties/new"
              className="mt-4 inline-block text-sm text-redline hover:underline"
            >
              Add Property
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Address / Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                    Customer
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    City / State
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Lot Size
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {properties.map((property) => {
                  const customer = property.customers as { first_name: string; last_name: string } | null;
                  return (
                    <tr key={property.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/properties/${property.id}`}
                          className="block"
                        >
                          <p className="font-medium text-charcoal hover:text-redline transition-colors">
                            {property.address_line1}
                          </p>
                          {property.property_name && (
                            <p className="text-xs text-muted">
                              {property.property_name}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted hidden md:table-cell">
                        {customer
                          ? `${customer.first_name} ${customer.last_name}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className="capitalize text-muted">
                          {property.property_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {property.city}, {property.state}
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {property.lot_size_sqft
                          ? `${property.lot_size_sqft.toLocaleString()} sqft`
                          : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge
                          label={property.active ? "Active" : "Inactive"}
                          variant={property.active ? "green" : "gray"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
