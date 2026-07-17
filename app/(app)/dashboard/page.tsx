import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  ClipboardList, Users, Calendar, Snowflake,
  Receipt, Package, AlertTriangle, CheckCircle2,
  TrendingUp, Clock
} from "lucide-react";

export const metadata = { title: "Dashboard" };

async function getDashboardData() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { count: newLeads },
    { count: activeCustomers },
    { data: todayJobs },
    { data: overdueinvoices },
    { count: lowStock },
    { count: maintenanceDue },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("jobs").select("id, title, status, scheduled_date, customers(first_name, last_name)").eq("scheduled_date", today).in("status", ["scheduled", "en_route", "arrived", "in_progress"]).limit(5),
    supabase.from("invoices").select("id, invoice_number, balance_due, due_date, customers(first_name, last_name)").eq("status", "overdue").order("due_date").limit(5),
    supabase.from("products").select("*", { count: "exact", head: true }).filter("current_quantity", "lte", "reorder_point").eq("active", true),
    supabase.from("assets").select("*", { count: "exact", head: true }).eq("status", "maintenance_due"),
    supabase.from("audit_logs").select("action, entity_type, actor_email, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  return { newLeads: newLeads ?? 0, activeCustomers: activeCustomers ?? 0, todayJobs: todayJobs ?? [], overdueinvoices: overdueinvoices ?? [], lowStock: lowStock ?? 0, maintenanceDue: maintenanceDue ?? 0, recentActivity: recentActivity ?? [] };
}

export default async function DashboardPage() {
  const data = await getDashboardData().catch(() => ({
    newLeads: 0, activeCustomers: 0, todayJobs: [], overdueinvoices: [],
    lowStock: 0, maintenanceDue: 0, recentActivity: [],
  }));

  const stats = [
    { label: "New Leads", value: data.newLeads, icon: ClipboardList, href: "/leads", color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Customers", value: data.activeCustomers, icon: Users, href: "/customers", color: "text-lawn", bg: "bg-lawn/10" },
    { label: "Today's Jobs", value: data.todayJobs.length, icon: Calendar, href: "/calendar", color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Overdue Invoices", value: data.overdueinvoices.length, icon: Receipt, href: "/invoices?status=overdue", color: "text-redline", bg: "bg-redline/10" },
    { label: "Low Stock Items", value: data.lowStock, icon: Package, href: "/inventory", color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Maintenance Due", value: data.maintenanceDue, icon: AlertTriangle, href: "/equipment", color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(stat => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon size={20} className={stat.color} />
            </div>
            <p className="text-2xl font-bold text-charcoal">{stat.value}</p>
            <p className="text-xs text-muted mt-1 group-hover:text-charcoal transition-colors">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Jobs */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-charcoal flex items-center gap-2">
              <Calendar size={16} className="text-lawn" />
              Today&apos;s Jobs
            </h2>
            <Link href="/jobs" className="text-xs text-redline hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data.todayJobs.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <CheckCircle2 size={32} className="mx-auto text-lawn mb-2" />
                <p className="text-sm text-muted">No jobs scheduled for today</p>
              </div>
            ) : (
              data.todayJobs.map((job: Record<string, unknown>) => {
                const customer = job.customers as Record<string, unknown> | null;
                return (
                  <Link
                    key={job.id as string}
                    href={`/jobs/${job.id}`}
                    className="block px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-charcoal">{job.title as string}</p>
                        <p className="text-xs text-muted">
                          {customer ? `${customer.first_name} ${customer.last_name}` : "Unknown"}
                        </p>
                      </div>
                      <JobStatusBadge status={job.status as string} />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Overdue Invoices */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-charcoal flex items-center gap-2">
              <Receipt size={16} className="text-redline" />
              Overdue Invoices
            </h2>
            <Link href="/invoices?status=overdue" className="text-xs text-redline hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data.overdueinvoices.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <CheckCircle2 size={32} className="mx-auto text-lawn mb-2" />
                <p className="text-sm text-muted">No overdue invoices</p>
              </div>
            ) : (
              data.overdueinvoices.map((inv: Record<string, unknown>) => {
                const customer = inv.customers as Record<string, unknown> | null;
                return (
                  <Link
                    key={inv.id as string}
                    href={`/invoices/${inv.id}`}
                    className="block px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-charcoal">{inv.invoice_number as string}</p>
                        <p className="text-xs text-muted">
                          {customer ? `${customer.first_name} ${customer.last_name}` : "Unknown"} · Due {formatDate(inv.due_date as string)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-redline">
                        {formatCurrency(inv.balance_due as number)}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "New Lead", href: "/leads/new", color: "bg-blue-600" },
            { label: "New Estimate", href: "/estimates/new", color: "bg-lawn" },
            { label: "New Job", href: "/jobs/new", color: "bg-orange-600" },
            { label: "Record Payment", href: "/payments/new", color: "bg-charcoal" },
            { label: "Snow Event", href: "/snow-events/new", color: "bg-ice border border-gray-200 text-charcoal" },
          ].map(action => (
            <Link
              key={action.label}
              href={action.href}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 ${action.color}`}
            >
              + {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {data.recentActivity.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-charcoal flex items-center gap-2">
              <Clock size={16} className="text-muted" />
              Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {data.recentActivity.map((log: Record<string, unknown>, i: number) => (
              <div key={i} className="px-6 py-3">
                <p className="text-sm text-charcoal">
                  <span className="font-medium">{log.actor_email as string}</span>
                  {" "}{(log.action as string).replace(/_/g, " ")} {log.entity_type as string}
                </p>
                <p className="text-xs text-muted">{formatDate(log.created_at as string, "MMM d, h:mm a")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    en_route: "bg-orange-100 text-orange-700",
    arrived: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-lawn/10 text-lawn",
    completed: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
