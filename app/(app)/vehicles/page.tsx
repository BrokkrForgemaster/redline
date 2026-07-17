import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Truck } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Vehicles" };

type AssetStatus =
  | "available"
  | "assigned"
  | "in_use"
  | "maintenance_due"
  | "out_of_service"
  | "retired"
  | "sold";

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

export default async function VehiclesPage() {
  const supabase = await createClient();

  const { data: vehicles } = await supabase
    .from("assets")
    .select(
      "id, asset_number, asset_type, make, model, year, license_plate, status, current_mileage, next_maintenance_date"
    )
    .in("asset_type", ["vehicle", "truck", "plow_truck", "van", "trailer"])
    .order("asset_number");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Vehicles</h1>
          <p className="text-sm text-muted">{vehicles?.length ?? 0} vehicles</p>
        </div>
        <Link
          href="/equipment/new"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Truck size={16} />
          Add Vehicle
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!vehicles || vehicles.length === 0 ? (
          <div className="py-16 text-center">
            <Truck size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No vehicles found</p>
            <p className="text-sm text-muted mt-1">
              Add vehicles and fleet assets to track them here
            </p>
            <Link
              href="/equipment/new"
              className="mt-4 inline-block text-sm text-redline hover:underline"
            >
              Add Vehicle
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
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Year / Make / Model
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                    License
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Mileage
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Next Service
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vehicles.map((vehicle) => {
                  const badge = assetStatusBadge(vehicle.status ?? "");
                  return (
                    <tr key={vehicle.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/equipment/${vehicle.id}`}
                          className="font-medium text-charcoal hover:text-redline"
                        >
                          {vehicle.asset_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-charcoal">
                        {[vehicle.year, vehicle.make, vehicle.model]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </td>
                      <td className="px-5 py-3 text-muted hidden md:table-cell">
                        {vehicle.license_plate ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge label={badge.label} variant={badge.variant} />
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {vehicle.current_mileage != null
                          ? `${vehicle.current_mileage.toLocaleString()} mi`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {formatDate(vehicle.next_maintenance_date)}
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
