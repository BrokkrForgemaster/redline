import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import dynamic from "next/dynamic";
import { formatDate } from "@/lib/utils/format";
import StatusBadge, { jobStatusBadge } from "@/components/ui/StatusBadge";
import { Plus, Briefcase, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import JobsLiveRefresh from "@/components/app/JobsLiveRefresh";
import JobsFilters from "@/components/app/JobsFilters";
import type { JobMapMarker } from "@/components/app/JobsMap";

const JobsMap = dynamic(() => import("@/components/app/JobsMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-b-xl bg-gray-100 animate-pulse" />
  ),
});

export const metadata = { title: "Jobs" };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; month?: string; customer?: string; crew?: string }>;
}) {
  const { status = "open", month, customer, crew } = await searchParams;
  const supabase = await createClient();

  // Parse month param; default to current month
  const now = new Date();
  let year = now.getFullYear();
  let mon = now.getMonth() + 1;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    [year, mon] = month.split("-").map(Number);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const currentMonth = `${year}-${pad(mon)}`;
  const monthStart = `${currentMonth}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const monthEnd = `${currentMonth}-${lastDay}`;

  const prevDate = new Date(year, mon - 2, 1);
  const nextDate = new Date(year, mon, 1);
  const prevMonth = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`;
  const nextMonth = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}`;

  const monthLabel = new Date(year, mon - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  function buildUrl(overrides: Record<string, string | undefined>) {
    const base: Record<string, string> = { status, month: currentMonth };
    if (customer) base.customer = customer;
    if (crew) base.crew = crew;
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => { if (v) p.set(k, v); });
    return `/jobs?${p.toString()}`;
  }

  const activeStatuses = ["scheduled", "en_route", "arrived", "in_progress", "paused", "quality_review"];
  const openStatuses = ["approved", "awaiting_deposit", "awaiting_materials", "ready_to_schedule", ...activeStatuses];

  let query = supabase
    .from("jobs")
    .select(`id, job_number, title, status, priority, scheduled_date, service_type,
      customers(id, first_name, last_name, business_name, account_type), crews(id, name)`)
    .gte("scheduled_date", monthStart)
    .lte("scheduled_date", monthEnd)
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(500);

  if (status === "active") query = query.in("status", activeStatuses);
  else if (status === "open") query = query.in("status", openStatuses);
  else if (status !== "all") query = query.eq("status", status);

  if (customer) query = query.eq("customer_id", customer);
  if (crew) query = query.eq("crew_id", crew);

  const [{ data: jobs }, { data: customers }, { data: crews }] = await Promise.all([
    query,
    supabase
      .from("customers")
      .select("id, first_name, last_name, business_name, account_type")
      .order("last_name"),
    supabase.from("crews").select("id, name").order("name"),
  ]);

  // Fetch the most-recent location tag per job for the map
  const jobIds = (jobs ?? []).map(j => j.id);
  const { data: locationTags } = jobIds.length > 0
    ? await supabase
        .from("job_location_tags")
        .select("job_id, latitude, longitude, captured_at_device")
        .in("job_id", jobIds)
        .order("captured_at_device", { ascending: false })
    : { data: [] };

  // Deduplicate — keep only the latest tag per job
  const latestByJob = new Map<string, { lat: number; lng: number }>();
  for (const tag of locationTags ?? []) {
    if (!latestByJob.has(tag.job_id)) {
      latestByJob.set(tag.job_id, {
        lat: Number(tag.latitude),
        lng: Number(tag.longitude),
      });
    }
  }

  const mapMarkers: JobMapMarker[] = (jobs ?? [])
    .filter(j => latestByJob.has(j.id))
    .map(j => {
      const loc = latestByJob.get(j.id)!;
      const c = j.customers as unknown as {
        first_name: string; last_name: string;
        business_name: string | null; account_type: string;
      } | null;
      return {
        jobId: j.id,
        jobNumber: j.job_number,
        title: j.title,
        customerName: c
          ? c.account_type === "business" && c.business_name
            ? c.business_name
            : `${c.first_name} ${c.last_name}`
          : "—",
        status: j.status,
        scheduledDate: j.scheduled_date,
        lat: loc.lat,
        lng: loc.lng,
      };
    });

  const tabs = ["open", "active", "completed", "cancelled", "all"];

  return (
    <div className="space-y-6">
      <JobsLiveRefresh />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Jobs</h1>
        <Link
          href="/jobs/new"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Plus size={16} /> New Job
        </Link>
      </div>

      {/* Month navigator */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link
          href={buildUrl({ month: prevMonth })}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-charcoal"
        >
          <ChevronLeft size={15} /> Prev
        </Link>
        <span className="font-semibold text-charcoal text-base">{monthLabel}</span>
        <Link
          href={buildUrl({ month: nextMonth })}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-charcoal"
        >
          Next <ChevronRight size={15} />
        </Link>
      </div>

      {/* Status tabs + filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map(t => (
            <Link
              key={t}
              href={buildUrl({ status: t })}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                status === t
                  ? "bg-charcoal text-white"
                  : "bg-gray-100 text-muted hover:bg-gray-200"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
        <JobsFilters customers={customers ?? []} crews={crews ?? []} />
      </div>

      {/* Job count */}
      {jobs && jobs.length > 0 && (
        <p className="text-sm text-muted px-1">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""} in {monthLabel}
        </p>
      )}

      {/* Location map */}
      {mapMarkers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-charcoal flex items-center gap-2">
              <MapPin size={16} className="text-muted" />
              Job Locations
            </h2>
            <span className="text-sm text-muted">
              {mapMarkers.length} of {jobs?.length ?? 0} job{jobs?.length !== 1 ? "s" : ""} have GPS data
            </span>
          </div>
          <JobsMap jobs={mapMarkers} />
        </div>
      )}

      {/* Jobs table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!jobs || jobs.length === 0 ? (
          <div className="py-16 text-center">
            <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No jobs found for {monthLabel}</p>
            <Link
              href="/jobs/new"
              className="mt-4 inline-block text-sm text-redline hover:underline"
            >
              Create a job
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Job #</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Title</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">Customer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">Scheduled</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden lg:table-cell">Crew</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map(job => {
                const badge = jobStatusBadge(job.status);
                const c = job.customers as unknown as Record<string, unknown> | null;
                const cr = job.crews as unknown as Record<string, unknown> | null;
                const customerName = c
                  ? c.account_type === "business" && c.business_name
                    ? String(c.business_name)
                    : `${c.first_name} ${c.last_name}`
                  : "—";
                return (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-medium text-charcoal hover:text-redline"
                      >
                        {job.job_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-charcoal">{job.title}</td>
                    <td className="px-5 py-3 text-muted hidden md:table-cell">{customerName}</td>
                    <td className="px-5 py-3">
                      <StatusBadge label={badge.label} variant={badge.variant} />
                    </td>
                    <td className="px-5 py-3 text-muted hidden sm:table-cell">
                      {formatDate(job.scheduled_date)}
                    </td>
                    <td className="px-5 py-3 text-muted hidden lg:table-cell">
                      {cr?.name as string ?? "Unassigned"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
