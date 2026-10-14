import Link from "next/link";
import { Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils/format";
import { requireStaffUser } from "@/lib/api/auth";
import { notFound } from "next/navigation";
import TimeClock from "./TimeClock";

export const metadata = { title: "Time Tracking" };

interface SearchParams {
  date?: string;
}

function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function TimeTrackingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { date } = await searchParams;
  const access = await requireStaffUser();
  if (!access.ok) notFound();
  const supabase = access.supabase;

  let query = supabase
    .from("time_entries")
    .select(
      "id, job_id, clock_in, clock_out, total_minutes, break_minutes, notes, is_manual, profiles!employee_id(first_name, last_name), jobs(job_number, title)"
    )
    .order("clock_in", { ascending: false })
    .limit(50);

  // Date filter
  if (date === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    query = query
      .gte("clock_in", start.toISOString())
      .lte("clock_in", end.toISOString());
  } else if (date === "week") {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    query = query.gte("clock_in", start.toISOString());
  }

  const { data: entries, error: entriesError } = await query;
  const { data: openEntry, error: openError } = await supabase.from("time_entries")
    .select("id, clock_in")
    .eq("employee_id", access.user.id)
    .is("job_id", null)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Personal and job time can overlap; adding them together would double-count hours.
  const workdayHours = ((entries?.reduce((sum, e) => sum + (e.job_id ? 0 : (e.total_minutes ?? 0)), 0) ?? 0) / 60).toFixed(1);
  const jobHours = ((entries?.reduce((sum, e) => sum + (e.job_id ? (e.total_minutes ?? 0) : 0), 0) ?? 0) / 60).toFixed(1);

  const tabs = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
  ];

  const activeTab = date ?? "all";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Time Tracking</h1>
          <p className="text-sm text-muted">
            {entries?.length ?? 0} recent entries · {workdayHours} workday hours and {jobHours} job hours in this list
          </p>
        </div>
      </div>

      {entriesError || openError ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">Time entries could not be loaded. Please refresh before clocking in or out.</p> : <TimeClock openEntry={openEntry} />}

      {/* Total Hours Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-redline/10 rounded-lg flex items-center justify-center">
            <Clock size={20} className="text-redline" />
          </div>
          <div>
            <p className="text-sm text-muted">Workday hours in recent entries</p>
            <p className="text-2xl font-bold text-charcoal">{workdayHours}h</p>
            <p className="text-xs text-muted">Job time: {jobHours}h, tracked separately</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={
              tab.key === "all"
                ? "/time-tracking"
                : `/time-tracking?date=${tab.key}`
            }
            className={
              activeTab === tab.key
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
        {!entries || entries.length === 0 ? (
          <div className="py-16 text-center">
            <Clock size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No time entries found</p>
            <p className="text-sm text-muted mt-1">
              {activeTab !== "all"
                ? "No entries for this time period"
                : "Log time to get started"}
            </p>
            <p className="mt-4 text-sm text-muted">Use the clock above to record your workday.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Employee
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                    Job
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Clock In
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Clock Out
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Duration
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Manual
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => {
                  const employee = entry.profiles as unknown as {
                    first_name: string;
                    last_name: string;
                  } | null;
                  const job = entry.jobs as unknown as {
                    job_number: string;
                    title: string;
                  } | null;

                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-charcoal">
                          {employee
                            ? `${employee.first_name} ${employee.last_name}`
                            : "—"}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-muted hidden md:table-cell">
                        {job ? (
                          <Link
                            href={`/jobs/${entry.job_id}`}
                            className="hover:text-redline transition-colors"
                          >
                            {job.job_number} — {job.title}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted hidden sm:table-cell">
                        {formatDateTime(entry.clock_in)}
                      </td>
                      <td className="px-5 py-3 text-muted hidden sm:table-cell">
                        {entry.clock_out ? formatDateTime(entry.clock_out) : (
                          <span className="text-green-600 font-medium">Active</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-medium text-charcoal">
                        {formatMinutes(entry.total_minutes)}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        {entry.is_manual ? (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                            Manual
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
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
