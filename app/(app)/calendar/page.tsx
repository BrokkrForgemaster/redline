"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { "en-US": enUS },
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Record<string, unknown>;
}

const statusColors: Record<string, { background: string; border: string; color: string }> = {
  scheduled: { background: "#3b82f6", border: "#2563eb", color: "#fff" },
  en_route: { background: "#f97316", border: "#ea580c", color: "#fff" },
  arrived: { background: "#eab308", border: "#ca8a04", color: "#fff" },
  in_progress: { background: "#22c55e", border: "#16a34a", color: "#fff" },
  completed: { background: "#6b7280", border: "#4b5563", color: "#fff" },
  cancelled: { background: "#ef4444", border: "#dc2626", color: "#fff" },
  paused: { background: "#a855f7", border: "#9333ea", color: "#fff" },
  weather_delayed: { background: "#60a5fa", border: "#3b82f6", color: "#fff" },
  quality_review: { background: "#8b5cf6", border: "#7c3aed", color: "#fff" },
};

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);

  const fetchJobs = useCallback(async (date: Date) => {
    setLoading(true);
    const supabase = createClient();
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const startOfCalMonth = format(monthStart, "yyyy-MM-dd");
    const endOfCalMonth = format(monthEnd, "yyyy-MM-dd");

    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, title, scheduled_date, scheduled_start, scheduled_end, status, service_type, customers(first_name, last_name)")
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", startOfCalMonth)
      .lte("scheduled_date", endOfCalMonth);

    if (jobs) {
      const jobsTyped = jobs as unknown as Array<Record<string, unknown>>;
      const mapped: CalendarEvent[] = jobsTyped.map((job) => {
        const customer = job.customers as Record<string, string> | null;
        const customerName = customer
          ? `${customer.first_name} ${customer.last_name}`
          : "No customer";
        const scheduledDate = job.scheduled_date as string;
        const scheduledStart = job.scheduled_start as string | null;
        const scheduledEnd = job.scheduled_end as string | null;

        return {
          id: job.id as string,
          title: `${job.title as string} — ${customerName}`,
          start: new Date(`${scheduledDate}T${scheduledStart ?? "08:00"}`),
          end: new Date(`${scheduledDate}T${scheduledEnd ?? "09:00"}`),
          resource: job,
        };
      });
      setEvents(mapped);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs(currentDate);
  }, [currentDate, fetchJobs]);

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleViewChange = (view: View) => {
    setCurrentView(view);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    router.push(`/jobs/${event.id}`);
  };

  const eventPropGetter = (event: CalendarEvent) => {
    const status = (event.resource?.status as string) ?? "scheduled";
    const colors = statusColors[status] ?? statusColors.scheduled;
    return {
      style: {
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderLeftWidth: "3px",
        color: colors.color,
        borderRadius: "4px",
        fontSize: "12px",
      },
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays size={24} className="text-redline" />
          <h1 className="text-2xl font-bold text-charcoal">Calendar</h1>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" />
            Loading…
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(statusColors).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-muted capitalize">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ backgroundColor: colors.background }}
            />
            {status.replace(/_/g, " ")}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ minHeight: 600 }}
          view={currentView}
          date={currentDate}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventPropGetter}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          popup
          tooltipAccessor={(event) => event.title}
        />
      </div>
    </div>
  );
}
