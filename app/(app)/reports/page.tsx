import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/format";
import { BarChart3, TrendingUp, Receipt, Users, Briefcase, Package } from "lucide-react";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

  const [
    { data: revenueMonthData },
    { data: revenueYearData },
    { count: newCustomers },
    { count: jobsCompleted },
    { data: topCustomers },
    { data: inventoryValue },
  ] = await Promise.all([
    supabase.from("payments").select("amount").gte("created_at", startOfMonth),
    supabase.from("payments").select("amount").gte("created_at", startOfYear),
    supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "completed").gte("created_at", startOfMonth),
    supabase.from("customers").select(`
      id, first_name, last_name,
      invoices(total, status)
    `).limit(5),
    supabase.from("products").select("current_quantity, purchase_cost").eq("active", true),
  ]);

  const revenueThisMonth = revenueMonthData?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const revenueThisYear = revenueYearData?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const totalInventoryValue = inventoryValue?.reduce((sum, p) => sum + (p.current_quantity * p.purchase_cost), 0) ?? 0;

  const kpis = [
    { label: "Revenue This Month", value: formatCurrency(revenueThisMonth), icon: TrendingUp, color: "text-lawn", bg: "bg-lawn/10" },
    { label: "Revenue This Year", value: formatCurrency(revenueThisYear), icon: BarChart3, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "New Customers", value: newCustomers ?? 0, suffix: "this month", icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Jobs Completed", value: jobsCompleted ?? 0, suffix: "this month", icon: Briefcase, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Inventory Value", value: formatCurrency(totalInventoryValue), icon: Package, color: "text-charcoal", bg: "bg-gray-100" },
  ];

  const reportLinks = [
    { label: "Revenue by Period", href: "/reports/revenue", description: "Monthly and annual revenue breakdown" },
    { label: "Invoice Aging", href: "/reports/aging", description: "Outstanding balances by age" },
    { label: "Job Profitability", href: "/reports/profitability", description: "Revenue vs. estimated cost per job" },
    { label: "Estimate Conversion", href: "/reports/conversion", description: "Lead-to-estimate-to-contract rates" },
    { label: "Material Usage", href: "/reports/materials", description: "Inventory usage by job and period" },
    { label: "Crew Workload", href: "/reports/crew-workload", description: "Hours and jobs per crew member" },
    { label: "Snow Event Profitability", href: "/reports/snow", description: "Revenue and costs per event" },
    { label: "Tax Summary", href: "/reports/tax", description: "Taxable revenue and tax collected" },
    { label: "Customer Acquisition", href: "/reports/acquisition", description: "Lead sources and conversion" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Reports</h1>
        <p className="text-sm text-muted mt-1">Business performance and financial reports.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
              <kpi.icon size={18} className={kpi.color} />
            </div>
            <p className="text-xl font-bold text-charcoal">{kpi.value}</p>
            <p className="text-xs text-muted mt-1">{kpi.label}</p>
            {kpi.suffix && <p className="text-xs text-muted">{kpi.suffix}</p>}
          </div>
        ))}
      </div>

      {/* Report Links */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Available Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportLinks.map(report => (
            <a
              key={report.href}
              href={report.href}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <p className="font-medium text-charcoal group-hover:text-redline transition-colors">{report.label}</p>
              <p className="text-sm text-muted mt-1">{report.description}</p>
            </a>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        Detailed reports require a connected Supabase database with populated data.
        Export functionality is available for owners and bookkeepers.
      </p>
    </div>
  );
}
