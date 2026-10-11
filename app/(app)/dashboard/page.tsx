import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canViewOperationsDashboard, getEffectiveRole } from "@/lib/auth/privileged-users";
import DashboardLiveRefresh from "@/components/app/DashboardLiveRefresh";
import JobsLiveRefresh from "@/components/app/JobsLiveRefresh";
import {
  Bell,
  Briefcase,
  CheckCircle2,
  Clock,
  Code2,
  MapPin,
  PlayCircle,
  Users,
} from "lucide-react";

export const metadata = { title: "Dashboard" };

type ProfileRow = { id: string; role: string; email: string | null };
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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

type CrewLocationRow = {
  employee_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  captured_at_device: string;
  profiles: { first_name: string; last_name: string; email: string } | null;
};

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, email")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return {
    user,
    profile: profile as ProfileRow,
    effectiveRole: getEffectiveRole(user.email, profile.role, profile.email),
    supabase,
  };
}

async function loadAssignedJobs(supabase: SupabaseServerClient, userId: string) {
  const sb = supabase as any;
  const [{ data: direct }, { data: crews }] = await Promise.all([
    sb.from("job_assignments").select("job_id").eq("employee_id", userId),
    sb.from("crew_members").select("crew_id").eq("employee_id", userId),
  ]);

  const directIds = ((direct ?? []) as { job_id: string }[]).map((r) => r.job_id);
  const crewIds = ((crews ?? []) as { crew_id: string }[]).map((r) => r.crew_id);
  const filters = [
    directIds.length ? `id.in.(${directIds.join(",")})` : null,
    crewIds.length ? `crew_id.in.(${crewIds.join(",")})` : null,
  ].filter(Boolean);

  if (filters.length === 0) return [];

  const { data } = await sb
    .from("jobs")
    .select(`
      id, job_number, title, status, scheduled_start,
      customers(first_name, last_name, business_name),
      properties(address_line1, city, state)
    `)
    .or(filters.join(","))
    .not("status", "in", "(cancelled,archived)")
    .order("scheduled_start", { ascending: true, nullsFirst: false });

  return (data ?? []) as JobRow[];
}

async function loadOperationsDashboard() {
  const supabase = await createClient();
  const sb = supabase as any;
  const [jobsResult, workOrdersResult, eventResult, locationsResult, crewsResult, usersResult] = await Promise.all([
    sb
      .from("jobs")
      .select("id, job_number, title, status, scheduled_start, customers(first_name, last_name, business_name), properties(address_line1, city, state)")
      .not("status", "in", "(cancelled,archived)")
      .order("scheduled_start", { ascending: true, nullsFirst: false })
      .limit(8),
    sb
      .from("work_orders")
      .select("id, work_order_number, title, status, scheduled_start, customers(first_name, last_name, business_name), properties(address_line1, city, state, latitude, longitude)")
      .not("status", "in", "(cancelled,completed,rejected)")
      .order("scheduled_start", { ascending: true, nullsFirst: false })
      .limit(8),
    sb
      .from("service_run_events")
      .select("id, event_type, created_at, service_run_id, profiles!service_run_events_actor_id_fkey(first_name, last_name, email), service_runs(work_orders(id, work_order_number, title))")
      .in("event_type", ["start", "finish"])
      .order("created_at", { ascending: false })
      .limit(8),
    sb
      .from("employee_location_points")
      .select("employee_id, latitude, longitude, accuracy_meters, captured_at_device, profiles(first_name, last_name, email)")
      .order("captured_at_device", { ascending: false })
      .limit(50),
    sb.from("crews").select("id", { count: "exact", head: true }).eq("active", true),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").neq("role", "customer"),
  ]);

  const latestByEmployee = new Map<string, CrewLocationRow>();
  for (const point of (locationsResult.data ?? []) as CrewLocationRow[]) {
    if (!latestByEmployee.has(point.employee_id)) latestByEmployee.set(point.employee_id, point);
  }

  const jobs = (jobsResult.data ?? []) as JobRow[];
  const workOrders = (workOrdersResult.data ?? []) as WorkOrderRow[];

  return {
    jobs,
    workOrders,
    events: (eventResult.data ?? []) as RunEventRow[],
    crewLocations: Array.from(latestByEmployee.values()),
    activeCrewCount: crewsResult.count ?? 0,
    activeUserCount: usersResult.count ?? 0,
    activeJobCount: jobs.filter((job) => ["en_route", "arrived", "in_progress", "paused"].includes(job.status)).length +
      workOrders.filter((wo) => ["in_progress", "paused"].includes(wo.status)).length,
  };
}

export default async function DashboardPage() {
  const { user, effectiveRole, supabase } = await getCurrentUser();

  if (canViewOperationsDashboard(effectiveRole)) {
    const data = await loadOperationsDashboard();
    return <OperationsDashboard data={data} role={effectiveRole} />;
  }

  const jobs = await loadAssignedJobs(supabase, user.id);
  return <SubcontractorDashboard jobs={jobs} />;
}

function OperationsDashboard({ data, role }: { data: Awaited<ReturnType<typeof loadOperationsDashboard>>; role: string }) {
  const isDeveloper = role === "developer";

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 bg-charcoal min-h-full p-4 md:p-6 lg:p-8">
      <DashboardLiveRefresh />
      <JobsLiveRefresh />
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{isDeveloper ? "Developer Dashboard" : "Admin Dashboard"}</h1>
            <p className="mt-1 text-sm text-gray-400">Live jobs, crew locations, and subcontractor start/end alerts.</p>
          </div>
          {isDeveloper && (
            <Link href="/settings/roles" className="inline-flex items-center gap-2 rounded-lg bg-redline px-3 py-2 text-sm font-semibold text-white">
              <Code2 size={16} /> Manage access
            </Link>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Active Jobs" value={data.activeJobCount} icon={PlayCircle} />
          <Metric label="Open Work Orders" value={data.workOrders.length} icon={Briefcase} />
          <Metric label="Active Crews" value={data.activeCrewCount} icon={Users} />
          <Metric label="Live Crew Pins" value={data.crewLocations.length} icon={MapPin} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Panel title="All Open Jobs">
            <JobList jobs={data.jobs} />
          </Panel>
          <Panel title="Live Alerts">
            <EventList events={data.events} />
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <Panel title="Work Orders">
            <WorkOrderList workOrders={data.workOrders} />
          </Panel>
          <Panel title="Crew Locations">
            <CrewLocationList locations={data.crewLocations} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SubcontractorDashboard({ jobs }: { jobs: JobRow[] }) {
  const active = jobs.filter((j) => j.status === "in_progress").length;
  const complete = jobs.filter((j) => j.status === "completed").length;
  const open = jobs.length - complete;

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 bg-charcoal min-h-full p-4 md:p-6 lg:p-8">
      <JobsLiveRefresh />
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Subcontractor Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">Track assigned work, GPS starts, and required before/after photos.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Open" value={open} icon={Briefcase} />
          <Metric label="Active" value={active} icon={PlayCircle} />
          <Metric label="Complete" value={complete} icon={CheckCircle2} />
        </div>
        <Panel title="Assigned Jobs">
          <JobList jobs={jobs} assigned />
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

function CrewLocationList({ locations }: { locations: CrewLocationRow[] }) {
  if (locations.length === 0) return <Empty text="No live crew locations have been reported." />;
  return locations.map((location) => {
    const worker = location.profiles ? `${location.profiles.first_name} ${location.profiles.last_name}` : "Crew member";
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
    return (
      <a key={location.employee_id} href={mapsUrl} target="_blank" rel="noreferrer" className="block px-4 py-4 hover:bg-white/5 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-white">{worker}</p>
            <p className="mt-1 text-sm text-gray-400">{Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)}</p>
            <p className="mt-1 text-xs text-gray-500">Updated {formatDateTime(location.captured_at_device)} · ±{Math.round(Number(location.accuracy_meters))}m</p>
          </div>
          <MapPin size={18} className="text-redline" />
        </div>
      </a>
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

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <Icon size={18} className="text-redline" />
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
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
