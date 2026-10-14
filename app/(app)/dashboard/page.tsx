import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canViewOperationsDashboard } from "@/lib/auth/privileged-users";
import { isOperationalRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/server";
import DashboardLiveRefresh from "@/components/app/DashboardLiveRefresh";
import JobsLiveRefresh from "@/components/app/JobsLiveRefresh";
import { parseOwnerDashboardTotals } from "@/lib/dashboard/totals";
import {
  Bell,
  Briefcase,
  CheckCircle2,
  Clock,
  MapPin,
  PlayCircle,
  Users,
} from "lucide-react";

export const metadata = { title: "Dashboard" };

type ProfileRow = { id: string; role: string; status: string; email: string | null };

type JobRow = {
  id: string;
  job_number: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  customers: { first_name: string; last_name: string; business_name: string | null } | null;
  properties: { address_line1: string; city: string; state: string } | null;
};

type WorkOrderRow = {
  id: string;
  work_order_number: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  customers: { first_name: string; last_name: string; business_name: string | null } | null;
  properties: { address_line1: string; city: string; state: string; latitude: number | null; longitude: number | null } | null;
};

const OPEN_LEGACY_STATUSES = ["pending_approval", "approved", "awaiting_deposit", "awaiting_materials", "ready_to_schedule", "scheduled", "en_route", "arrived", "in_progress", "paused", "quality_review", "follow_up_required", "weather_delayed"];
const OPEN_WORK_ORDER_STATUSES = ["scheduled", "assigned", "ready", "in_progress", "paused", "submitted", "needs_review"];

type RunEventRow = {
  id: string;
  event_type: string;
  created_at: string;
  service_run_id: string;
  profiles: { first_name: string; last_name: string; email: string } | null;
  service_runs: {
    work_orders: { id: string; work_order_number: string; title: string } | null;
  } | null;
};

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, status, email")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") redirect("/login");

  return {
    user,
    profile: profile as ProfileRow,
    effectiveRole: profile.role,
    supabase,
  };
}

async function loadAssignedWork(userId: string) {
  const sb = createAdminClient();
  const [{ data: direct, error: directError }, { data: crews, error: crewError }, { data: companies, error: companyError }] = await Promise.all([
    sb.from("job_assignments").select("job_id").eq("employee_id", userId),
    sb.from("crew_members").select("crew_id, crews!inner(active)").eq("employee_id", userId).eq("crews.active", true),
    sb.from("subcontractor_memberships").select("subcontractor_company_id, subcontractor_companies!inner(status)").eq("user_id", userId).eq("active", true).eq("subcontractor_companies.status", "active"),
  ]);
  if (directError || crewError || companyError) throw new Error("Could not verify assigned work.");

  const directIds = ((direct ?? []) as { job_id: string }[]).map((r) => r.job_id);
  const crewIds = ((crews ?? []) as { crew_id: string }[]).map((r) => r.crew_id);
  const companyIds = ((companies ?? []) as { subcontractor_company_id: string }[]).map(r => r.subcontractor_company_id);
  const assignmentFilters = [
    `employee_id.eq.${userId}`,
    ...(crewIds.length ? [`crew_id.in.(${crewIds.join(",")})`] : []),
    ...(companyIds.length ? [`subcontractor_company_id.in.(${companyIds.join(",")})`] : []),
  ];
  const { data: assignments, error: assignmentError } = await sb.from("work_order_assignments")
    .select("work_order_id").eq("active", true).or(assignmentFilters.join(","));
  if (assignmentError) throw new Error("Could not load work-order assignments.");
  const workOrderIds = [...new Set(((assignments ?? []) as { work_order_id: string }[]).map(row => row.work_order_id))];
  const workOrderResult = workOrderIds.length
    ? await sb.from("work_orders").select("id, legacy_job_id, work_order_number, title, status, scheduled_start, customers(first_name, last_name, business_name), properties(address_line1, city, state, latitude, longitude)")
      .in("id", workOrderIds).order("scheduled_start", { ascending: true, nullsFirst: false })
    : { data: [], error: null };
  if (workOrderResult.error) throw new Error("Could not load assigned work orders.");
  const workOrders = (workOrderResult.data ?? []) as (WorkOrderRow & { legacy_job_id: string | null })[];
  const canonicalLegacyIds = new Set(workOrders.map(row => row.legacy_job_id).filter(Boolean));
  const filters = [
    directIds.length ? `id.in.(${directIds.join(",")})` : null,
    crewIds.length ? `crew_id.in.(${crewIds.join(",")})` : null,
  ].filter(Boolean);

  if (filters.length === 0) return { jobs: [] as JobRow[], workOrders };

  const { data, error } = await sb
    .from("jobs")
    .select(`
      id, job_number, title, status, scheduled_start,
      customers(first_name, last_name, business_name),
      properties(address_line1, city, state)
    `)
    .or(filters.join(","))
    .in("status", OPEN_LEGACY_STATUSES)
    .order("scheduled_start", { ascending: true, nullsFirst: false });

  if (error) throw new Error("Could not load assigned legacy jobs.");
  return { jobs: ((data ?? []) as unknown as JobRow[]).filter(row => !canonicalLegacyIds.has(row.id)), workOrders };
}

async function loadOperationsDashboard() {
  const supabase = await createClient();
  // Migration 031 adds the dashboard RPC; generated database types lag local SQL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [jobsResult, workOrdersResult, eventResult, crewsResult, usersResult, totalsResult] = await Promise.all([
    sb
      .from("jobs")
      .select("id, job_number, title, status, scheduled_start, customers(first_name, last_name, business_name), properties(address_line1, city, state)")
      .in("status", OPEN_LEGACY_STATUSES)
      .order("scheduled_start", { ascending: true, nullsFirst: false })
      .limit(8),
    sb
      .from("work_orders")
      .select("id, work_order_number, title, status, scheduled_start, customers(first_name, last_name, business_name), properties(address_line1, city, state, latitude, longitude)")
      .in("status", OPEN_WORK_ORDER_STATUSES)
      .order("scheduled_start", { ascending: true, nullsFirst: false })
      .limit(8),
    sb
      .from("service_run_events")
      .select("id, event_type, created_at, service_run_id, profiles!service_run_events_actor_id_fkey(first_name, last_name, email), service_runs(work_orders(id, work_order_number, title))")
      .in("event_type", ["start", "finish"])
      .order("created_at", { ascending: false })
      .limit(8),
    sb.from("crews").select("id", { count: "exact", head: true }).eq("active", true),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").neq("role", "customer"),
    sb.rpc("owner_dashboard_counts"),
  ]);
  if (jobsResult.error || workOrdersResult.error || eventResult.error || crewsResult.error || usersResult.error) {
    throw new Error("Dashboard data is unavailable. Please retry after the database is updated.");
  }

  const jobs = (jobsResult.data ?? []) as JobRow[];
  const workOrders = (workOrdersResult.data ?? []) as WorkOrderRow[];

  return {
    jobs,
    workOrders,
    events: (eventResult.data ?? []) as RunEventRow[],
    activeCrewCount: crewsResult.count ?? 0,
    activeUserCount: usersResult.count ?? 0,
    ...parseOwnerDashboardTotals(totalsResult.data?.[0], !!totalsResult.error),
  };
}

export default async function DashboardPage() {
  const { user, effectiveRole } = await getCurrentUser();

  if (effectiveRole === "developer") {
    return <div className="rounded-xl border bg-white p-6"><h1 className="text-xl font-semibold">Developer Support</h1><p className="mt-2 text-sm">Technical support access is separate from Admin. Business data requires an explicit scoped grant.</p></div>;
  }

  if (canViewOperationsDashboard(effectiveRole)) {
    let data: Awaited<ReturnType<typeof loadOperationsDashboard>> | null = null;
    try {
      data = await loadOperationsDashboard();
    } catch {
      // The UI below shows an explicit unavailable state, never stale totals.
    }
    return data ? <OperationsDashboard data={data} role={effectiveRole} /> : <DashboardUnavailable />;
  }

  if (!isOperationalRole(effectiveRole)) redirect("/login");
  let assigned: Awaited<ReturnType<typeof loadAssignedWork>> | null = null;
  try {
    assigned = await loadAssignedWork(user.id);
  } catch {
    // Keep an assignment failure visible without exposing partial work.
  }
  return assigned ? <AssignedDashboard {...assigned} role={effectiveRole} /> : <DashboardUnavailable />;
}

function DashboardUnavailable() {
  return <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
    <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
    <p className="mt-2 text-sm">Work could not be refreshed. Please retry after the database update or contact Admin support.</p>
    <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold underline">Retry dashboard</Link>
  </div>;
}

function OperationsDashboard({ data, role }: { data: Awaited<ReturnType<typeof loadOperationsDashboard>>; role: string }) {
  return (
    <div className="-m-4 md:-m-6 lg:-m-8 bg-charcoal min-h-full p-4 md:p-6 lg:p-8">
      <DashboardLiveRefresh />
      <JobsLiveRefresh />
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{role === "owner" ? "Admin Dashboard" : "Dashboard"}</h1>
            <p className="mt-1 text-sm text-gray-400">Open work and recorded start and finish events.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Active Jobs" value={data.activeJobCount ?? "Unavailable"} icon={PlayCircle} href="/jobs?status=active" />
          <Metric label="Open Work Orders" value={data.openWorkOrderCount ?? "Unavailable"} icon={Briefcase} href="/work-orders" />
          <Metric label="Active Crews" value={data.activeCrewCount} icon={Users} href="/crews" />
          <Metric label="Active Staff" value={data.activeUserCount} icon={Users} href="/employees" />
        </div>
        {data.totalsUnavailable && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-950/50 px-4 py-3 text-sm text-amber-100">
          Job totals are unavailable until the dashboard migration is applied. Preview lists are limited and are not totals.
        </p>}

        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Panel title="Legacy Open Jobs Preview">
            <JobList jobs={data.jobs} />
          </Panel>
          <Panel title="Recent Start and Finish Events">
            <EventList events={data.events} />
          </Panel>
        </div>

        <div className="grid gap-5">
          <Panel title="Work Orders">
            <WorkOrderList workOrders={data.workOrders} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AssignedDashboard({ jobs, workOrders, role }: { jobs: JobRow[]; workOrders: WorkOrderRow[]; role: string }) {
  const active = jobs.filter(j => j.status === "in_progress").length + workOrders.filter(wo => wo.status === "in_progress").length;
  const complete = workOrders.filter(wo => wo.status === "completed").length;
  const open = jobs.length + workOrders.filter(wo => OPEN_WORK_ORDER_STATUSES.includes(wo.status)).length;
  const title = role === "subcontractor" ? "Subcontractor Dashboard" : role === "mowing_crew_lead" ? "Mowing Crew Lead Dashboard" : role === "mowing_crew_laborer" ? "Mowing Crew Laborer Dashboard" : "Snow Plow Operator Dashboard";

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 bg-charcoal min-h-full p-4 md:p-6 lg:p-8">
      <JobsLiveRefresh />
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-gray-400">Track assigned work, GPS starts, and required before/after photos.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Open" value={open} icon={Briefcase} />
          <Metric label="Active" value={active} icon={PlayCircle} />
          <Metric label="Complete" value={complete} icon={CheckCircle2} />
        </div>
        <Panel title="Assigned Jobs">
          {workOrders.map(workOrder => (
            <Link key={workOrder.id} href={`/my-jobs/run/${workOrder.id}`} className="block px-4 py-4 hover:bg-white/5 transition-colors">
              <RowTitle number={workOrder.work_order_number} title={workOrder.title} customer={formatCustomer(workOrder.customers)} address={formatAddress(workOrder.properties)} status={workOrder.status} />
            </Link>
          ))}
          {jobs.length > 0 ? <JobList jobs={jobs} assigned /> : workOrders.length === 0 ? <Empty text="No assigned jobs yet." /> : null}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      <div className="divide-y divide-white/10">{children}</div>
    </div>
  );
}

function JobList({ jobs, assigned = false }: { jobs: JobRow[]; assigned?: boolean }) {
  if (jobs.length === 0) return <Empty text={assigned ? "No assigned jobs yet." : "No open jobs."} />;
  return jobs.map((job) => (
    <Link key={job.id} href={assigned ? `/my-jobs/${job.id}` : `/jobs/${job.id}`} className="block px-4 py-4 hover:bg-white/5 transition-colors">
      <RowTitle number={job.job_number} title={job.title} customer={formatCustomer(job.customers)} address={formatAddress(job.properties)} status={job.status} />
    </Link>
  ));
}

function WorkOrderList({ workOrders }: { workOrders: WorkOrderRow[] }) {
  if (workOrders.length === 0) return <Empty text="No open work orders." />;
  return workOrders.map((workOrder) => (
    <Link key={workOrder.id} href={`/service-runs`} className="block px-4 py-4 hover:bg-white/5 transition-colors">
      <RowTitle
        number={workOrder.work_order_number}
        title={workOrder.title}
        customer={formatCustomer(workOrder.customers)}
        address={formatAddress(workOrder.properties)}
        status={workOrder.status}
      />
    </Link>
  ));
}

function EventList({ events }: { events: RunEventRow[] }) {
  if (events.length === 0) return <Empty text="No start or end alerts yet." />;
  return events.map((event) => {
    const worker = event.profiles ? `${event.profiles.first_name} ${event.profiles.last_name}` : "Subcontractor";
    const workOrder = event.service_runs?.work_orders;
    return (
      <Link key={event.id} href={`/service-runs/${event.service_run_id}`} className="block px-4 py-4 hover:bg-white/5 transition-colors">
        <div className="flex items-start gap-3">
          <Bell size={18} className="mt-1 text-redline" />
          <div className="min-w-0">
            <p className="font-semibold text-white">{worker} {event.event_type === "start" ? "started" : "ended"} a job</p>
            <p className="mt-1 text-sm text-gray-400">{workOrder?.work_order_number ?? "Work order"} {workOrder?.title ?? ""}</p>
            <p className="mt-1 text-xs text-gray-500">{formatDateTime(event.created_at)}</p>
          </div>
        </div>
      </Link>
    );
  });
}

function RowTitle({ number, title, customer, address, status }: { number: string; title: string; customer: string; address: string; status: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">#{number}</p>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-gray-400">{customer}</p>
        {address && (
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-400">
            <MapPin size={13} /> {address}
          </p>
        )}
      </div>
      <Status status={status} />
    </div>
  );
}

function Metric({ label, value, icon: Icon, href }: { label: string; value: number | string; icon: React.ElementType; href?: string }) {
  const content = (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-4 ${href ? "transition-colors hover:border-redline focus-within:border-redline" : ""}`}>
      <Icon size={18} className="text-redline" />
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
  return href ? <Link href={href} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-redline" aria-label={`View ${label}`}>{content}</Link> : content;
}

function Status({ status }: { status: string }) {
  const Icon = status === "in_progress" ? Clock : status === "completed" ? CheckCircle2 : Briefcase;
  const styles =
    status === "in_progress" ? "bg-redline/20 text-red-300" :
    status === "completed"   ? "bg-lawn/20 text-green-300" :
                               "bg-white/10 text-gray-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles}`}>
      <Icon size={12} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-12 text-center text-sm text-gray-500">{text}</div>;
}

function formatCustomer(customer: JobRow["customers"] | WorkOrderRow["customers"]) {
  return customer?.business_name ?? (customer ? `${customer.first_name} ${customer.last_name}` : "Customer");
}

function formatAddress(property: JobRow["properties"] | WorkOrderRow["properties"]) {
  return property ? `${property.address_line1}, ${property.city}, ${property.state}` : "";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
