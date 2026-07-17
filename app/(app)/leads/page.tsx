import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate, formatPhone } from "@/lib/utils/format";
import StatusBadge from "@/components/ui/StatusBadge";
import { Plus, ClipboardList } from "lucide-react";

export const metadata = { title: "Leads" };

const LEAD_STATUS_COLORS: Record<string, "blue" | "yellow" | "green" | "red" | "gray"> = {
  new: "blue",
  contacted: "yellow",
  site_visit_scheduled: "yellow",
  site_visit_completed: "yellow",
  estimate_in_progress: "orange" as "yellow",
  estimate_sent: "blue",
  awaiting_customer: "yellow",
  won: "green",
  lost: "red",
  archived: "gray",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "open" } = await searchParams;
  const supabase = await createClient();

  const openStatuses = ["new", "contacted", "site_visit_scheduled", "site_visit_completed", "estimate_in_progress", "estimate_sent", "awaiting_customer"];

  let query = supabase
    .from("leads")
    .select(`id, first_name, last_name, email, phone, status, source, requested_services, follow_up_date, created_at,
      profiles!assigned_to(first_name, last_name)`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status === "open") query = query.in("status", openStatuses);
  else if (status !== "all") query = query.eq("status", status);

  const { data: leads } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Leads</h1>
        <Link href="/leads/new" className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors">
          <Plus size={16} /> New Lead
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["open", "won", "lost", "all"].map(s => (
          <Link key={s} href={`/leads?status=${s}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${status === s ? "bg-charcoal text-white" : "bg-white border border-gray-200 text-muted hover:bg-gray-50"}`}>
            {s}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {(!leads || leads.length === 0) ? (
          <div className="py-16 text-center">
            <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No leads found</p>
            <Link href="/leads/new" className="mt-4 inline-block text-sm text-redline hover:underline">Add a lead</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">Contact</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden lg:table-cell">Source</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden lg:table-cell">Follow Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map(lead => {
                const isOverdue = lead.follow_up_date && new Date(lead.follow_up_date) < new Date() && !["won", "lost", "archived"].includes(lead.status);
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-charcoal hover:text-redline">
                        {lead.first_name} {lead.last_name}
                      </Link>
                      {lead.requested_services?.length > 0 && (
                        <p className="text-xs text-muted">{lead.requested_services.slice(0, 2).join(", ")}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted hidden md:table-cell">
                      {lead.email && <p>{lead.email}</p>}
                      {lead.phone && <p>{formatPhone(lead.phone)}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge
                        label={lead.status.replace(/_/g, " ")}
                        variant={LEAD_STATUS_COLORS[lead.status] ?? "gray"}
                      />
                    </td>
                    <td className="px-5 py-3 text-muted hidden lg:table-cell capitalize">{lead.source?.replace(/_/g, " ")}</td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      {lead.follow_up_date ? (
                        <span className={isOverdue ? "text-redline font-semibold" : "text-muted"}>
                          {isOverdue ? "⚠ " : ""}{formatDate(lead.follow_up_date)}
                        </span>
                      ) : <span className="text-muted">—</span>}
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
