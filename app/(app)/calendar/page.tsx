"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { CalendarDays, Loader2 } from "lucide-react";
import { toBusinessWallDate } from "@/lib/calendar/business-time";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { "en-US": enUS },
});

type CalendarRecord = {
  id: string;
  title: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string | null;
  timezone: string;
  customers: { business_name: string | null } | null;
};

type LegacyCalendarRecord = {
  id: string;
  title: string;
  status: string;
  scheduled_date: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  customers: { business_name: string | null } | null;
  properties: { timezone: string | null } | null;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: { status: string; source: "canonical" | "legacy" };
};

const statusColors: Record<string, string> = {
  scheduled: "#3b82f6",
  assigned: "#3b82f6",
  ready: "#3b82f6",
  in_progress: "#22c55e",
  paused: "#a855f7",
  submitted: "#eab308",
  needs_review: "#eab308",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

function mapCalendarRecords(records: CalendarRecord[]): CalendarEvent[] {
  return records.map(record => {
    const timezone = record.timezone || "America/New_York";
    const start = toBusinessWallDate(record.scheduled_start, timezone);
    const scheduledEnd = record.scheduled_end ? toBusinessWallDate(record.scheduled_end, timezone) : null;
    const customer = record.customers?.business_name || "Job site";
    return {
      id: record.id,
      title: `${record.title} — ${customer} (${timezone})`,
      start,
      end: scheduledEnd && scheduledEnd > start ? scheduledEnd : new Date(start.getTime() + 60 * 60 * 1000),
      resource: { status: record.status, source: "canonical" },
    };
  });
}

function mapLegacyRecords(records: LegacyCalendarRecord[]): CalendarEvent[] {
  return records.map(record => {
    const timezone = record.properties?.timezone || "America/New_York";
    const [year, month, day] = record.scheduled_date.split("-").map(Number);
    const start = record.scheduled_start
      ? toBusinessWallDate(record.scheduled_start, timezone)
      : new Date(year, month - 1, day, 8);
    const scheduledEnd = record.scheduled_end ? toBusinessWallDate(record.scheduled_end, timezone) : null;
    const customer = record.customers?.business_name || "Job site";
    return {
      id: record.id,
      title: `${record.title} — ${customer} (legacy)`,
      start,
      end: scheduledEnd && scheduledEnd > start ? scheduledEnd : new Date(start.getTime() + 60 * 60 * 1000),
      resource: { status: record.status, source: "legacy" },
    };
  });
}

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [retryNumber, setRetryNumber] = useState(0);

  const fetchMonth = useCallback(async (date: Date, signal: AbortSignal) => {
    try {
      const response = await fetch(`/api/v1/calendar?month=${format(date, "yyyy-MM")}`, {
        signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Calendar could not be refreshed. Check your connection and try again.");
      const body = await response.json() as { events: CalendarRecord[]; legacy_jobs: LegacyCalendarRecord[] };
      const mapped = [...mapCalendarRecords(body.events), ...mapLegacyRecords(body.legacy_jobs)];
      if (!signal.aborted) {
        setEvents(mapped);
        setError(null);
      }
    } catch (cause) {
      if (!signal.aborted) {
        setEvents([]);
        setError(cause instanceof Error ? cause.message : "Calendar could not be refreshed.");
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void fetchMonth(currentDate, controller.signal); }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentDate, retryNumber, fetchMonth]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays size={24} className="text-redline" />
          <h1 className="text-2xl font-bold text-charcoal">Calendar</h1>
        </div>
        {loading && <span className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Loading…</span>}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error} <button type="button" className="font-semibold underline" onClick={() => {
            setLoading(true);
            setRetryNumber(previous => previous + 1);
          }}>Retry</button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-muted capitalize">
            <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: color }} />
            {status.replace(/_/g, " ")}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ minHeight: 600 }}
          view={currentView}
          date={currentDate}
          onNavigate={date => {
            setLoading(true);
            setCurrentDate(date);
          }}
          onView={setCurrentView}
          onSelectEvent={event => router.push(event.resource.source === "legacy" ? `/my-jobs/${event.id}` : `/my-jobs/run/${event.id}`)}
          eventPropGetter={event => ({ style: {
            backgroundColor: statusColors[event.resource.status] ?? statusColors.scheduled,
            borderRadius: "4px", fontSize: "12px", color: "white",
          } })}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          popup
        />
      </div>
    </div>
  );
}
