import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate } from "@/lib/utils/format";
import StatusBadge, { jobStatusBadge } from "@/components/ui/StatusBadge";
import { Plus, Briefcase } from "lucide-react";

export const metadata = { title: "Jobs" };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "active" } = await searchParams;
  const supabase = await createClient();

  const activeStatuses = ["scheduled", "en_route", "arrived", "in_progress", "paused", "quality_review"];
  const openStatuses = ["approved", "awaiting_deposit", "awaiting_materials", "ready_to_schedule", ...activeStatuses];

  let query = supabase
    .from("jobs")
    .select(`id, job_number, title, status, priority, scheduled_date, service_type,
      customers(first_name, last_name), crews(name)`)
    .order("scheduled_date", { ascending: true })
    .limit(50);

  if (status === "active") query = query.in("status", activeStatuses);
  else if (status === "open") query = query.in("status", openStatuses);
  else if (status !== "all") query = query.eq("status", status);

  const { data: jobs } = await query;

  const tabs = ["open", "active", "completed", "cancelled", "all"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Jobs</h1>
        <Link href="/jobs/new" className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors">
          <Plus size={16} /> New Job
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-2">
        {tabs.map(t => (
          <Link key={t} href={`/jobs?status=${t}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${status === t ? "bg-charcoal text-white" : "bg-gray-100 text-muted hover:bg-gray-200"}`}>
            {t}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {(!jobs || jobs.length === 0) ? (
          <div className="py-16 text-center">
            <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No jobs found</p>
            <Link href="/jobs/new" className="mt-4 inline-block text-sm text-redline hover:underline">Create a job</Link>
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
                const customer = job.customers as Record<string, unknown> | null;
                const crew = job.crews as Record<string, unknown> | null;
                return (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/jobs/${job.id}`} className="font-medium text-charcoal hover:text-redline">{job.job_number}</Link>
                    </td>
                    <td className="px-5 py-3 text-charcoal">{job.title}</td>
                    <td className="px-5 py-3 text-muted hidden md:table-cell">
                      {customer ? `${customer.first_name} ${customer.last_name}` : "—"}
                    </td>
                    <td className="px-5 py-3"><StatusBadge label={badge.label} variant={badge.variant} /></td>
                    <td className="px-5 py-3 text-muted hidden sm:table-cell">{formatDate(job.scheduled_date)}</td>
                    <td className="px-5 py-3 text-muted hidden lg:table-cell">{crew?.name as string ?? "Unassigned"}</td>
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
