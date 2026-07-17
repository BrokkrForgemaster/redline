import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase, MapPin, Clock, ChevronRight } from "lucide-react";

export const metadata = { title: "My Jobs" };

const SERVICE_LABELS: Record<string, string> = {
  lawn_mowing: "Lawn Mowing",
  landscaping: "Landscaping",
  aeration_overseeding: "Aeration & Overseeding",
  snow_removal: "Snow Removal",
  spring_cleanup: "Spring Cleanup",
  fall_cleanup: "Fall Cleanup",
  mulching: "Mulching",
  irrigation: "Irrigation",
  other: "General Service",
};

export default async function MyJobsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const today = new Date().toISOString().split("T")[0];

  // Crew memberships for this employee
  const { data: memberships } = await sb
    .from("crew_members")
    .select("crew_id")
    .eq("employee_id", user.id);

  const crewIds = ((memberships ?? []) as { crew_id: string }[]).map(m => m.crew_id);

  // Today's jobs from those crews
  let jobs: Record<string, unknown>[] = [];
  if (crewIds.length > 0) {
    const { data } = await sb
      .from("jobs")
      .select(`
        id, job_number, title, service_type, status, scheduled_start,
        customers(first_name, last_name, business_name),
        properties(address_line1, city, state)
      `)
      .in("crew_id", crewIds)
      .eq("scheduled_date", today)
      .not("status", "in", ["cancelled", "archived", "completed"])
      .order("scheduled_start", { ascending: true, nullsFirst: false });
    jobs = data ?? [];
  }

  // Also surface any job this employee is currently clocked in to
  const { data: activeEntries } = await sb
    .from("time_entries")
    .select("job_id")
    .eq("employee_id", user.id)
    .is("clock_out", null);

  const activeJobIds = ((activeEntries ?? []) as { job_id: string | null }[])
    .map(e => e.job_id)
    .filter(Boolean) as string[];

  if (activeJobIds.length > 0) {
    const existingIds = jobs.map(j => (j as { id: string }).id);
    const missing = activeJobIds.filter(id => !existingIds.includes(id));
    if (missing.length > 0) {
      const { data: extra } = await sb
        .from("jobs")
        .select(`
          id, job_number, title, service_type, status, scheduled_start,
          customers(first_name, last_name, business_name),
          properties(address_line1, city, state)
        `)
        .in("id", missing);
      jobs = [...(extra ?? []), ...jobs];
    }
  }

  const dayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-4 max-w-xl mx-auto px-1">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">My Jobs</h1>
        <p className="text-sm text-muted mt-0.5">{dayLabel}</p>
      </div>

      {jobs.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-200">
          <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-charcoal">No jobs today</p>
          <p className="text-sm text-muted mt-1 max-w-xs mx-auto">
            You&apos;re not assigned to any jobs today. Check with your manager if you think this is wrong.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const j = job as {
              id: string; job_number: string; title: string; service_type: string;
              status: string; scheduled_start: string | null;
              customers: { first_name: string; last_name: string; business_name: string | null } | null;
              properties: { address_line1: string; city: string; state: string } | null;
            };
            const isActive = activeJobIds.includes(j.id);
            const name = j.customers?.business_name ??
              (j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : "");
            const address = j.properties
              ? `${j.properties.address_line1}, ${j.properties.city}`
              : "";
            const label = j.title || SERVICE_LABELS[j.service_type] || "Job";

            return (
              <Link
                key={j.id}
                href={`/my-jobs/${j.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all active:scale-[0.98]"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-lawn/10 text-lawn px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-lawn rounded-full animate-pulse" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-muted">#{j.job_number}</span>
                    )}
                  </div>
                  <p className="font-semibold text-charcoal leading-tight">{label}</p>
                  {name && <p className="text-sm text-muted">{name}</p>}
                  {address && (
                    <div className="flex items-center gap-1 text-sm text-muted">
                      <MapPin size={12} className="flex-shrink-0" />
                      <span className="truncate">{address}</span>
                    </div>
                  )}
                  {j.scheduled_start && (
                    <div className="flex items-center gap-1 text-sm text-muted">
                      <Clock size={12} className="flex-shrink-0" />
                      <span>
                        {new Date(j.scheduled_start).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
