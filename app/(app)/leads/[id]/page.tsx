import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatPhone } from "@/lib/utils/format";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ChevronRight, Edit, UserPlus, Mail, Phone,
  Building2, MapPin, Calendar, FileText
} from "lucide-react";
import LeadStatusUpdater from "./LeadStatusUpdater";

const LEAD_STATUS_COLORS: Record<string, "blue" | "yellow" | "green" | "red" | "gray" | "orange"> = {
  new: "blue",
  contacted: "yellow",
  site_visit_scheduled: "yellow",
  site_visit_completed: "yellow",
  estimate_in_progress: "orange",
  estimate_sent: "blue",
  awaiting_customer: "yellow",
  won: "green",
  lost: "red",
  archived: "gray",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("first_name, last_name").eq("id", id).single();
  return { title: data ? `${data.first_name} ${data.last_name}` : "Lead" };
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*, profiles!assigned_to(first_name, last_name)")
    .eq("id", id)
    .single();

  if (!lead) notFound();

  const assignee = lead.profiles as { first_name: string; last_name: string } | null;
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || "Unknown";
  const statusColor = LEAD_STATUS_COLORS[lead.status] ?? "gray";

  const QUICK_TRANSITIONS: { label: string; status: string; show: boolean }[] = [
    { label: "Mark Contacted", status: "contacted", show: lead.status === "new" },
    { label: "Schedule Site Visit", status: "site_visit_scheduled", show: ["contacted"].includes(lead.status) },
    { label: "Site Visit Complete", status: "site_visit_completed", show: lead.status === "site_visit_scheduled" },
    { label: "Start Estimate", status: "estimate_in_progress", show: lead.status === "site_visit_completed" },
    { label: "Send Estimate", status: "estimate_sent", show: lead.status === "estimate_in_progress" },
    { label: "Awaiting Customer", status: "awaiting_customer", show: lead.status === "estimate_sent" },
    { label: "Mark Won", status: "won", show: !["won", "lost", "archived"].includes(lead.status) },
    { label: "Mark Lost", status: "lost", show: !["won", "lost", "archived"].includes(lead.status) },
    { label: "Archive", status: "archived", show: ["won", "lost"].includes(lead.status) },
  ].filter(t => t.show);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/leads" className="text-sm text-muted hover:text-charcoal">Leads</Link>
            <ChevronRight size={14} className="text-muted" />
            <span className="text-sm text-charcoal font-medium">{fullName}</span>
          </div>
          <h1 className="text-2xl font-bold text-charcoal">{fullName}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <StatusBadge
              label={lead.status.replace(/_/g, " ")}
              variant={statusColor}
            />
            {lead.source && (
              <span className="text-xs text-muted capitalize">{lead.source.replace(/_/g, " ")}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href={`/leads/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit size={15} />
            Edit
          </Link>
          {lead.status === "won" && !lead.converted_customer_id && (
            <Link
              href={`/customers/new?leadId=${id}`}
              className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
            >
              <UserPlus size={15} />
              Convert to Customer
            </Link>
          )}
          {lead.converted_customer_id && (
            <Link
              href={`/customers/${lead.converted_customer_id}`}
              className="flex items-center gap-2 bg-lawn text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-colors"
            >
              View Customer
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Contact + Lead Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-charcoal">Contact Information</h2>
            {lead.email && (
              <div className="flex items-start gap-3">
                <Mail size={16} className="text-muted mt-0.5 flex-shrink-0" />
                <a href={`mailto:${lead.email}`} className="text-sm text-charcoal hover:text-redline">{lead.email}</a>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-start gap-3">
                <Phone size={16} className="text-muted mt-0.5 flex-shrink-0" />
                <a href={`tel:${lead.phone}`} className="text-sm text-charcoal hover:text-redline">{formatPhone(lead.phone)}</a>
              </div>
            )}
            {lead.company_name && (
              <div className="flex items-start gap-3">
                <Building2 size={16} className="text-muted mt-0.5 flex-shrink-0" />
                <span className="text-sm text-charcoal">{lead.company_name}</span>
              </div>
            )}
            {lead.service_address && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-muted mt-0.5 flex-shrink-0" />
                <span className="text-sm text-charcoal">{lead.service_address}</span>
              </div>
            )}
            {!lead.email && !lead.phone && !lead.company_name && !lead.service_address && (
              <p className="text-sm text-muted">No contact information on file.</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-charcoal">Lead Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Source</span>
                <span className="text-charcoal capitalize">{lead.source?.replace(/_/g, " ") ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Assigned To</span>
                <span className="text-charcoal">
                  {assignee ? `${assignee.first_name} ${assignee.last_name}` : "Unassigned"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Follow Up</span>
                <span className={`${lead.follow_up_date && new Date(lead.follow_up_date) < new Date() && !["won", "lost", "archived"].includes(lead.status) ? "text-redline font-semibold" : "text-charcoal"}`}>
                  {lead.follow_up_date ? formatDate(lead.follow_up_date) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Created</span>
                <span className="text-charcoal">{formatDate(lead.created_at)}</span>
              </div>
            </div>

            {lead.requested_services && lead.requested_services.length > 0 && (
              <div>
                <p className="text-sm text-muted mb-2">Requested Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {lead.requested_services.map((svc: string) => (
                    <span key={svc} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-charcoal capitalize">
                      {svc.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {lead.notes && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={14} className="text-muted" />
                  <p className="text-sm text-muted">Notes</p>
                </div>
                <p className="text-sm text-charcoal whitespace-pre-line">{lead.notes}</p>
              </div>
            )}

            {lead.loss_reason && lead.status === "lost" && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-xs font-medium text-red-700 mb-1">Loss Reason</p>
                <p className="text-sm text-red-600">{lead.loss_reason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Actions + Status */}
        <div className="lg:col-span-2 space-y-6">
          {QUICK_TRANSITIONS.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-charcoal mb-4">Quick Actions</h2>
              <div className="flex flex-wrap gap-2">
                {QUICK_TRANSITIONS.map(t => (
                  <LeadStatusUpdater
                    key={t.status}
                    leadId={id}
                    status={t.status}
                    label={t.label}
                    variant={t.status === "won" ? "primary" : t.status === "lost" ? "danger" : "secondary"}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-charcoal mb-4">Activity Timeline</h2>
            <div className="text-sm text-muted py-8 text-center">
              <Calendar size={32} className="mx-auto text-gray-200 mb-2" />
              <p>Activity log coming soon.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
