import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Equipment" };

function assetStatusBadge(status: string): {
  label: string;
  variant: "green" | "blue" | "yellow" | "red" | "gray";
} {
  const map: Record<string, { label: string; variant: "green" | "blue" | "yellow" | "red" | "gray" }> = {
    available: { label: "Available", variant: "green" },
    assigned: { label: "Assigned", variant: "blue" },
    in_use: { label: "In Use", variant: "blue" },
    maintenance_due: { label: "Maintenance Due", variant: "yellow" },
    out_of_service: { label: "Out of Service", variant: "red" },
    retired: { label: "Retired", variant: "gray" },
    sold: { label: "Sold", variant: "gray" },
  };
  return map[status] ?? { label: status.replace(/_/g, " "), variant: "gray" };
}

interface SearchParams {
  status?: string;
  type?: string;
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status, type } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("assets")
    .select(
      "id, asset_number, asset_type, make, model, year, status, current_hours, current_mileage, next_maintenance_date, storage_location"
    )
    .order("asset_number")
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (type && type !== "all") {
    query = query.eq("asset_type", type);
  }

  const { data: assets } = await query;

  const statusTabs = [
    { key: "all", label: "All" },
    { key: "available", label: "Available" },
    { key: "maintenance_due", label: "Maintenance Due" },
    { key: "out_of_service", label: "Out of Service" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Equipment</h1>
          <p className="text-sm text-muted">{assets?.length ?? 0} assets</p>
        </div>
        <Link
          href="/equipment/new"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Plus size={16} />
          New Asset
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {statusTabs.map((tab) => (
          <Link
            key={tab.key}
            href={
              tab.key === "all"
                ? `/equipment${type ? `?type=${type}` : ""}`
                : `/equipment?status=${tab.key}${type ? `&type=${type}` : ""}`
            }
            className={
              (status ?? "all") === tab.key
                ? "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors bg-charcoal text-white"
                : "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors bg-white border border-gray-200 text-muted hover:bg-gray-50"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!assets || assets.length === 0 ? (
          <div className="py-16 text-center">
            <Wrench size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No assets found</p>
            <p className="text-sm text-muted mt-1">
              {status && status !== "all"
                ? `No ${status.replace(/_/g, " ")} assets`
                : "Add your first asset to get started"}
            </p>
            <Link
              href="/equipment/new"
              className="mt-4 inline-block text-sm text-redline hover:underline"
            >
              New Asset
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Asset #
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Make / Model / Year
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Hours / Mileage
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Next Service
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {assets.map((asset) => {
                  const badge = assetStatusBadge(asset.status ?? "");
                  const makeModelYear = [asset.year, asset.make, asset.model]
                    .filter(Boolean)
                    .join(" ");

                  const hoursMileage = [
                    asset.current_hours != null
                      ? `${asset.current_hours.toLocaleString()} hrs`
                      : null,
                    asset.current_mileage != null
                      ? `${asset.current_mileage.toLocaleString()} mi`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" / ");

                  return (
                    <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/equipment/${asset.id}`}
                          className="block"
                        >
                          <p className="font-medium text-charcoal hover:text-redline transition-colors">
                            {asset.asset_number}
                          </p>
                          {asset.storage_location && (
                            <p className="text-xs text-muted">
                              {asset.storage_location}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted capitalize hidden sm:table-cell">
                        {asset.asset_type?.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-charcoal">
                        {makeModelYear || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge label={badge.label} variant={badge.variant} />
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {hoursMileage || "—"}
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {formatDate(asset.next_maintenance_date)}
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
