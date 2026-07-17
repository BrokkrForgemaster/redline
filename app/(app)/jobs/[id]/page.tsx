import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import StatusBadge, { jobStatusBadge } from "@/components/ui/StatusBadge";
import {
  ChevronRight, Edit, Clock, User, MapPin, Wrench,
  Calendar, AlertTriangle, ClipboardList
} from "lucide-react";
import JobStatusUpdater from "./JobStatusUpdater";

const PRIORITY_COLORS: Record<string, "gray" | "blue" | "yellow" | "red"> = {
  low: "gray",
  normal: "blue",
  high: "yellow",
  urgent: "red",
};

const JOB_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending_approval: ["approved", "cancelled"],
  approved: ["awaiting_deposit", "awaiting_materials", "ready_to_schedule", "cancelled"],
  awaiting_deposit: ["ready_to_schedule", "cancelled"],
  awaiting_materials: ["ready_to_schedule", "cancelled"],
  ready_to_schedule: ["scheduled", "cancelled"],
  scheduled: ["en_route", "weather_delayed", "cancelled"],
  en_route: ["arrived"],
  arrived: ["in_progress"],
  in_progress: ["paused", "quality_review", "completed"],
  paused: ["in_progress", "cancelled"],
  quality_review: ["completed", "follow_up_required", "in_progress"],
  follow_up_required: ["in_progress", "completed"],
  weather_delayed: ["scheduled", "cancelled"],
  completed: ["archived"],
  cancelled: [],
  archived: [],
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("title, job_number").eq("id", id).single();
  return { title: data ? `${data.job_number} — ${data.title}` : "Job" };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select(`
      *,
      customers(id, first_name, last_name, business_name, account_type),
      properties(id, address_line1, city, state, property_name),
      crews(id, name)
    `)
    .eq("id", id)
    .single();

  if (!job) notFound();

  const [{ data: assignments }, { data: timeEntries }] = await Promise.all([
    supabase
      .from("job_assignments")
      .select("id, role, profiles!employee_id(first_name, last_name)")
      .eq("job_id", id),
    supabase
      .from("time_entries")
      .select("id, clock_in, clock_out, break_minutes, notes, profiles!employee_id(first_name, last_name)")
      .eq("job_id", id)
      .order("clock_in", { ascending: false }),
  ]);

  const customer = job.customers as unknown as { id: string; first_name: string; last_name: string; business_name: string | null; account_type: string } | null;
  const property = job.properties as unknown as { id: string; address_line1: string; city: string; state: string; property_name: string | null } | null;
  const crew = job.crews as unknown as { id: string; name: string } | null;

  const badge = jobStatusBadge(job.status);
  const nextStatuses = JOB_STATUS_TRANSITIONS[job.status] ?? [];

  function calcHours(clockIn: string, clockOut: string | null, breakMins: number): string {
    if (!clockOut) return "In progress";
    const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    const totalMins = Math.floor(ms / 60000) - breakMins;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/jobs" className="text-sm text-muted hover:text-charcoal">Jobs</Link>
            <ChevronRight size={14} className="text-muted" />
            <span className="text-sm text-charcoal font-medium">{job.job_number}</span>
          </div>
          <h1 className="text-2xl font-bold text-charcoal">{job.title}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted font-mono">{job.job_number}</span>
            <StatusBadge label={badge.label} variant={badge.variant} />
            <StatusBadge
              label={job.priority}
              variant={PRIORITY_COLORS[job.priority] ?? "gray"}
              className="capitalize"
            />
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href={`/jobs/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit size={15} />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-charcoal flex items-center gap-2">
              <Wrench size={16} className="text-muted" />
              Job Details
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted mb-0.5">Service Type</p>
                <p className="text-charcoal font-medium capitalize">{job.service_type.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-muted mb-0.5">Customer</p>
                {customer ? (
                  <Link href={`/customers/${customer.id}`} className="text-charcoal font-medium hover:text-redline">
                    {customer.account_type === "business" && customer.business_name
                      ? customer.business_name
                      : `${customer.first_name} ${customer.last_name}`}
                  </Link>
                ) : (
                  <p className="text-charcoal">—</p>
                )}
              </div>
              {property && (
                <div className="col-span-2">
                  <p className="text-muted mb-0.5">Property</p>
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-muted mt-0.5 flex-shrink-0" />
                    <Link href={`/properties/${property.id}`} className="text-charcoal hover:text-redline">
                      {property.property_name ?? property.address_line1}, {property.city}, {property.state}
                    </Link>
                  </div>
                </div>
              )}
              <div>
                <p className="text-muted mb-0.5">Scheduled Date</p>
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-muted" />
                  <p className="text-charcoal">{formatDate(job.scheduled_date)}</p>
                </div>
              </div>
              <div>
                <p className="text-muted mb-0.5">Start Time</p>
                <p className="text-charcoal">{job.scheduled_start ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted mb-0.5">Estimated Hours</p>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-muted" />
                  <p className="text-charcoal">{job.estimated_hours != null ? `${job.estimated_hours}h` : "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-muted mb-0.5">Crew</p>
                <div className="flex items-center gap-1.5">
                  <User size={14} className="text-muted" />
                  <p className="text-charcoal">{crew?.name ?? "Unassigned"}</p>
                </div>
              </div>
            </div>

            {job.description && (
              <div>
                <p className="text-muted text-xs uppercase font-semibold tracking-wide mb-1">Description</p>
                <p className="text-sm text-charcoal whitespace-pre-line">{job.description}</p>
              </div>
            )}

            {assignments && assignments.length > 0 && (
              <div>
                <p className="text-muted text-xs uppercase font-semibold tracking-wide mb-2">Assigned Employees</p>
                <div className="flex flex-wrap gap-2">
                  {assignments.map(a => {
                    const profile = a.profiles as unknown as { first_name: string; last_name: string } | null;
                    return (
                      <span key={a.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-charcoal text-xs font-medium rounded-full">
                        <User size={11} />
                        {profile ? `${profile.first_name} ${profile.last_name}` : "Unknown"}
                        {a.role === "leader" && <span className="text-lawn">★</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Work Instructions */}
          {job.work_instructions && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-charcoal flex items-center gap-2 mb-3">
                <ClipboardList size={16} className="text-muted" />
                Work Instructions
              </h2>
              <p className="text-sm text-charcoal whitespace-pre-line">{job.work_instructions}</p>
            </div>
          )}

          {/* Access Notes */}
          {job.access_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h2 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
                <AlertTriangle size={16} />
                Access Notes
              </h2>
              <p className="text-sm text-amber-700 whitespace-pre-line">{job.access_notes}</p>
            </div>
          )}

          {/* Time Entries */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-charcoal flex items-center gap-2">
                <Clock size={16} className="text-muted" />
                Time Entries
              </h2>
            </div>
            {(!timeEntries || timeEntries.length === 0) ? (
              <p className="text-sm text-muted px-5 py-6 text-center">No time entries recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Employee</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Clock In</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Clock Out</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {timeEntries.map(entry => {
                    const profile = entry.profiles as unknown as { first_name: string; last_name: string } | null;
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-charcoal">
                          {profile ? `${profile.first_name} ${profile.last_name}` : "—"}
                        </td>
                        <td className="px-5 py-3 text-muted">{formatDateTime(entry.clock_in)}</td>
                        <td className="px-5 py-3 text-muted">{entry.clock_out ? formatDateTime(entry.clock_out) : <span className="text-lawn text-xs font-medium">Active</span>}</td>
                        <td className="px-5 py-3 text-charcoal font-medium">
                          {calcHours(entry.clock_in, entry.clock_out, entry.break_minutes ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column: Status */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-charcoal">Status</h2>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Current</span>
              <StatusBadge label={badge.label} variant={badge.variant} />
            </div>

            {nextStatuses.length > 0 && (
              <div>
                <p className="text-xs text-muted uppercase font-semibold tracking-wide mb-2">Update Status</p>
                <div className="flex flex-col gap-2">
                  {nextStatuses.map(s => (
                    <JobStatusUpdater key={s} jobId={id} status={s} />
                  ))}
                </div>
              </div>
            )}

            {job.actual_start && (
              <div className="text-xs text-muted pt-2 border-t border-gray-100">
                <p>Started: {formatDateTime(job.actual_start)}</p>
                {job.actual_end && <p className="mt-0.5">Ended: {formatDateTime(job.actual_end)}</p>}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 text-sm">
            <h2 className="font-semibold text-charcoal">Meta</h2>
            <div className="flex justify-between">
              <span className="text-muted">Created</span>
              <span className="text-charcoal">{formatDate(job.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Updated</span>
              <span className="text-charcoal">{formatDate(job.updated_at)}</span>
            </div>
            {job.is_recurring && (
              <div className="pt-2 border-t border-gray-100">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                  Recurring
                </span>
                {job.recurrence_rule && (
                  <p className="text-xs text-muted mt-1 font-mono">{job.recurrence_rule}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
