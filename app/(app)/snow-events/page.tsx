import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate } from "@/lib/utils/format";
import StatusBadge from "@/components/ui/StatusBadge";
import { Plus, Snowflake } from "lucide-react";

export const metadata = { title: "Snow Events" };

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

export default async function SnowEventsPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("snow_events")
    .select("id, event_number, event_name, status, operational_priority, forecast_start, actual_snowfall_inches, created_at, profiles!manager_id(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(30);

  const active = events?.filter(e => !["completed", "cancelled"].includes(e.status)) ?? [];
  const past = events?.filter(e => ["completed", "cancelled"].includes(e.status)) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Snow Events</h1>
          {active.length > 0 && (
            <p className="text-sm text-redline font-medium mt-1">{active.length} active event{active.length !== 1 ? "s" : ""}</p>
          )}
        </div>
        <Link href="/snow-events/new" className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors">
          <Plus size={16} /> New Event
        </Link>
      </div>

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Active Events</h2>
          <div className="grid gap-4">
            {active.map(event => (
              <Link key={event.id} href={`/snow-events/${event.id}`}
                className="block bg-white rounded-xl border-2 border-redline/30 p-5 hover:border-redline transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-charcoal">{event.event_name}</p>
                    <p className="text-xs text-muted">{event.event_number} · {formatDate(event.forecast_start)}</p>
                  </div>
                  <StatusBadge label={event.status.replace(/_/g, " ")} variant={STATUS_COLORS[event.status] ?? "gray"} />
                </div>
                <div className="mt-3 flex gap-4 text-xs text-muted">
                  <span>Priority: <strong className="text-charcoal capitalize">{event.operational_priority}</strong></span>
                  {event.actual_snowfall_inches && <span>Snowfall: <strong className="text-charcoal">{event.actual_snowfall_inches}"</strong></span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Past Events</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Event</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">Snowfall</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {past.map(event => (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/snow-events/${event.id}`} className="font-medium text-charcoal hover:text-redline">{event.event_name}</Link>
                      <p className="text-xs text-muted">{event.event_number}</p>
                    </td>
                    <td className="px-5 py-3 text-muted hidden md:table-cell">{formatDate(event.forecast_start)}</td>
                    <td className="px-5 py-3 text-muted hidden sm:table-cell">
                      {event.actual_snowfall_inches ? `${event.actual_snowfall_inches}"` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={event.status.replace(/_/g, " ")} variant={STATUS_COLORS[event.status] ?? "gray"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(!events || events.length === 0) && (
        <div className="py-16 text-center bg-white rounded-xl border border-gray-200">
          <Snowflake size={40} className="mx-auto text-blue-200 mb-3" />
          <p className="font-medium text-charcoal">No snow events yet</p>
          <p className="text-sm text-muted mt-1">Create an event to begin snow operations tracking</p>
          <Link href="/snow-events/new" className="mt-4 inline-block text-sm text-redline hover:underline">Create Snow Event</Link>
        </div>
      )}
    </div>
  );
}
