import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ChevronRight, Edit, Snowflake, Thermometer,
  AlertTriangle, CloudSnow, MapPin, Clock
} from "lucide-react";
import SnowEventStatusUpdater from "./SnowEventStatusUpdater";

const STATUS_COLORS: Record<string, "blue" | "yellow" | "green" | "red" | "gray" | "orange"> = {
  monitoring: "blue",
  preparing: "yellow",
  activated: "orange",
  in_progress: "green",
  paused: "yellow",
  cleanup: "blue",
  completed: "gray",
  cancelled: "gray",
};

const PRIORITY_COLORS: Record<string, "gray" | "blue" | "yellow" | "red"> = {
  low: "gray",
  normal: "blue",
  high: "yellow",
  emergency: "red",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  monitoring: ["preparing", "activated", "cancelled"],
  preparing: ["activated", "cancelled"],
  activated: ["in_progress", "paused", "cancelled"],
  in_progress: ["paused", "cleanup", "completed"],
  paused: ["in_progress", "cleanup", "cancelled"],
  cleanup: ["completed"],
  completed: [],
  cancelled: [],
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("snow_events").select("event_name, event_number").eq("id", id).single();
  return { title: data ? `${data.event_number} — ${data.event_name}` : "Snow Event" };
}

export default async function SnowEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("snow_events")
    .select("*, profiles!manager_id(first_name, last_name)")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const { data: routes } = await supabase
    .from("routes")
    .select("id, route_name, route_type, status, crews(name)")
    .eq("snow_event_id", id)
    .order("created_at");

  const manager = event.profiles as { first_name: string; last_name: string } | null;
  const statusColor = STATUS_COLORS[event.status] ?? "gray";
  const nextStatuses = STATUS_TRANSITIONS[event.status] ?? [];

  const routeStatusColors: Record<string, "gray" | "blue" | "green" | "yellow"> = {
    draft: "gray",
    assigned: "blue",
    in_progress: "yellow",
    completed: "green",
    cancelled: "gray",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/snow-events" className="text-sm text-muted hover:text-charcoal">Snow Events</Link>
            <ChevronRight size={14} className="text-muted" />
            <span className="text-sm text-charcoal font-medium">{event.event_name}</span>
          </div>
          <h1 className="text-2xl font-bold text-charcoal">{event.event_name}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted font-mono">{event.event_number}</span>
            <StatusBadge
              label={event.status.replace(/_/g, " ")}
              variant={statusColor}
            />
            <StatusBadge
              label={event.operational_priority}
              variant={PRIORITY_COLORS[event.operational_priority] ?? "gray"}
              className="capitalize"
            />
            {event.ice_risk && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                <AlertTriangle size={10} />
                Ice Risk
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href={`/snow-events/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit size={15} />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Event details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Forecast & Actuals */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <h2 className="font-semibold text-charcoal flex items-center gap-2">
              <CloudSnow size={16} className="text-blue-500" />
              Event Information
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted mb-0.5">Forecast Start</p>
                <p className="text-charcoal font-medium">{formatDateTime(event.forecast_start)}</p>
              </div>
              <div>
                <p className="text-muted mb-0.5">Forecast End</p>
                <p className="text-charcoal font-medium">{formatDateTime(event.forecast_end)}</p>
              </div>
              {event.actual_start && (
                <div>
                  <p className="text-muted mb-0.5">Actual Start</p>
                  <p className="text-charcoal font-medium">{formatDateTime(event.actual_start)}</p>
                </div>
              )}
              {event.actual_end && (
                <div>
                  <p className="text-muted mb-0.5">Actual End</p>
                  <p className="text-charcoal font-medium">{formatDateTime(event.actual_end)}</p>
                </div>
              )}
              <div>
                <p className="text-muted mb-0.5 flex items-center gap-1"><Snowflake size={12} /> Expected Snowfall</p>
                <p className="text-charcoal font-medium">
                  {event.expected_snowfall_inches != null ? `${event.expected_snowfall_inches}"` : "—"}
                </p>
              </div>
              {event.actual_snowfall_inches != null && (
                <div>
                  <p className="text-muted mb-0.5 flex items-center gap-1"><Snowflake size={12} /> Actual Snowfall</p>
                  <p className="text-charcoal font-medium">{event.actual_snowfall_inches}"</p>
                </div>
              )}
              <div>
                <p className="text-muted mb-0.5 flex items-center gap-1"><Thermometer size={12} /> Low Temp</p>
                <p className="text-charcoal font-medium">
                  {event.temperature_low != null ? `${event.temperature_low}°F` : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted mb-0.5">Ice Risk</p>
                <p className={`font-medium ${event.ice_risk ? "text-blue-600" : "text-charcoal"}`}>
                  {event.ice_risk ? "Yes — treatment required" : "No"}
                </p>
              </div>
            </div>

            {event.weather_notes && (
              <div>
                <p className="text-xs text-muted uppercase font-semibold tracking-wide mb-1">Weather Notes</p>
                <p className="text-sm text-charcoal whitespace-pre-line">{event.weather_notes}</p>
              </div>
            )}
          </div>

          {/* Routes */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-charcoal flex items-center gap-2">
                <MapPin size={16} className="text-muted" />
                Routes ({routes?.length ?? 0})
              </h2>
              <Link
                href={`/routes/new?snowEventId=${id}`}
                className="text-xs text-redline hover:underline"
              >
                + Add Route
              </Link>
            </div>
            {(!routes || routes.length === 0) ? (
              <div className="py-10 text-center">
                <MapPin size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-muted">No routes assigned to this event yet.</p>
                <Link href={`/routes/new?snowEventId=${id}`} className="mt-2 inline-block text-sm text-redline hover:underline">
                  Create a route
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Route</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">Crew</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {routes.map(route => {
                    const crew = route.crews as unknown as { name: string } | null;
                    return (
                      <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <Link href={`/routes/${route.id}`} className="font-medium text-charcoal hover:text-redline">
                            {route.route_name}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-muted hidden sm:table-cell capitalize">{route.route_type.replace(/_/g, " ")}</td>
                        <td className="px-5 py-3 text-muted hidden md:table-cell">{crew?.name ?? "Unassigned"}</td>
                        <td className="px-5 py-3">
                          <StatusBadge
                            label={route.status.replace(/_/g, " ")}
                            variant={routeStatusColors[route.status] ?? "gray"}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Status + Operational */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-charcoal">Status</h2>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Current</span>
              <StatusBadge label={event.status.replace(/_/g, " ")} variant={statusColor} />
            </div>

            {nextStatuses.length > 0 && (
              <div>
                <p className="text-xs text-muted uppercase font-semibold tracking-wide mb-2">Advance Status</p>
                <div className="flex flex-col gap-2">
                  {nextStatuses.map(s => (
                    <SnowEventStatusUpdater key={s} eventId={id} status={s} />
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 text-xs text-muted space-y-1">
              <p>Created: {formatDate(event.created_at)}</p>
              <p>Updated: {formatDate(event.updated_at)}</p>
            </div>
          </div>

          {/* Operational */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-charcoal flex items-center gap-2">
              <Clock size={16} className="text-muted" />
              Operations
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Priority</span>
                <StatusBadge
                  label={event.operational_priority}
                  variant={PRIORITY_COLORS[event.operational_priority] ?? "gray"}
                  className="capitalize"
                />
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Manager</span>
                <span className="text-charcoal">
                  {manager ? `${manager.first_name} ${manager.last_name}` : "Unassigned"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Routes</span>
                <span className="text-charcoal font-medium">{routes?.length ?? 0}</span>
              </div>
            </div>

            {event.event_notes && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-muted uppercase font-semibold tracking-wide mb-1">Event Notes</p>
                <p className="text-sm text-charcoal whitespace-pre-line">{event.event_notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
