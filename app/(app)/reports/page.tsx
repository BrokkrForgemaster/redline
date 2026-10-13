import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Briefcase, Camera, CheckCircle2, Users } from "lucide-react";
import { hasMfaAssurance } from "@/lib/api/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const metadata = { title: "Operational Reports" };

const OPEN_STATUSES = ["scheduled", "assigned", "ready", "in_progress", "paused", "submitted", "needs_review"];

export default async function ReportsPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const sb = createAdminClient();
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("role, status").eq("id", user.id).single();
  if (profileError || profile?.status !== "active" || profile.role !== "owner") redirect("/dashboard");
  if (!(await hasMfaAssurance(client))) redirect("/mfa/challenge");

  const [openOrders, completedVisits, awaitingReview, pendingEvidence, activeCrews] = await Promise.all([
    sb.from("work_orders").select("id", { count: "exact", head: true }).in("status", OPEN_STATUSES),
    sb.from("service_runs").select("id", { count: "exact", head: true }).eq("status", "completed"),
    sb.from("service_runs").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
    sb.from("media_assets").select("id", { count: "exact", head: true }).eq("status", "pending_upload"),
    sb.from("crews").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  if ([openOrders, completedVisits, awaitingReview, pendingEvidence, activeCrews].some(result => result.error)) {
    throw new Error("Operational report data is unavailable. Please retry.");
  }

  const metrics = [
    { label: "Open work orders", value: openOrders.count ?? 0, icon: Briefcase },
    { label: "Completed visits", value: completedVisits.count ?? 0, icon: CheckCircle2 },
    { label: "Visits needing review", value: awaitingReview.count ?? 0, icon: BarChart3 },
    { label: "Uploads awaiting attachment", value: pendingEvidence.count ?? 0, icon: Camera },
    { label: "Active crews", value: activeCrews.count ?? 0, icon: Users },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Operational Reports</h1>
        <p className="mt-1 text-sm text-muted">Current counts across authorized work. Pending phone data appears after synchronization.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(metric => (
          <div key={metric.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <metric.icon size={20} className="text-redline" />
            <p className="mt-3 text-2xl font-bold text-charcoal">{metric.value}</p>
            <p className="text-sm text-muted">{metric.label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/service-runs" className="rounded-xl border border-gray-200 bg-white p-4 font-medium text-charcoal hover:border-redline">Review service visits</Link>
        <Link href="/crews" className="rounded-xl border border-gray-200 bg-white p-4 font-medium text-charcoal hover:border-redline">Review crew assignments</Link>
      </div>
    </div>
  );
}
