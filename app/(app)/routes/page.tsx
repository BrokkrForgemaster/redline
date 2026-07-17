import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Routes" };

type RouteStatus = "draft" | "assigned" | "in_progress" | "completed" | "cancelled";

function routeStatusBadge(status: string): {
  label: string;
  variant: "gray" | "blue" | "green" | "yellow" | "orange";
} {
  const map: Record<string, { label: string; variant: "gray" | "blue" | "green" | "yellow" | "orange" }> = {
    draft: { label: "Draft", variant: "gray" },
    assigned: { label: "Assigned", variant: "blue" },
    in_progress: { label: "In Progress", variant: "yellow" },
    completed: { label: "Completed", variant: "green" },
    cancelled: { label: "Cancelled", variant: "gray" },
  };
  return map[status] ?? { label: status.replace(/_/g, " "), variant: "gray" };
}

interface SearchParams {
  status?: string;
}

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("routes")
    .select(
      "id, route_name, route_type, status, job_date, estimated_start, crews(name), created_at"
    )
    .order("job_date", { ascending: false })
    .limit(50);

  if (status && status !== "all") {
    query = query.eq("status", status as RouteStatus);
  }

  const { data: routes } = await query;

  const tabs = ["all", "draft", "assigned", "in_progress", "completed"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Routes</h1>
          <p className="text-sm text-muted">{routes?.length ?? 0} routes</p>
        </div>
        <Link
          href="/routes/new"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Plus size={16} />
          New Route
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={tab === "all" ? "/routes" : `/routes?status=${tab}`}
            className={
              (status ?? "all") === tab
                ? "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors bg-charcoal text-white"
                : "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors bg-white border border-gray-200 text-muted hover:bg-gray-50"
            }
          >
            {tab.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!routes || routes.length === 0 ? (
          <div className="py-16 text-center">
            <MapPin size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No routes found</p>
            <p className="text-sm text-muted mt-1">
              {status && status !== "all"
                ? `No ${status.replace(/_/g, " ")} routes`
                : "Create your first route to get started"}
            </p>
            <Link
              href="/routes/new"
              className="mt-4 inline-block text-sm text-redline hover:underline"
            >
              New Route
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Route Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                    Date
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Crew
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {routes.map((route) => {
                  const crew = route.crews as { name: string } | null;
                  const badge = routeStatusBadge(route.status);
                  return (
                    <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/routes/${route.id}`}
                          className="font-medium text-charcoal hover:text-redline"
                        >
                          {route.route_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted capitalize hidden sm:table-cell">
                        {route.route_type?.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge label={badge.label} variant={badge.variant} />
                      </td>
                      <td className="px-5 py-3 text-muted hidden md:table-cell">
                        {formatDate(route.job_date)}
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {crew?.name ?? "—"}
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
