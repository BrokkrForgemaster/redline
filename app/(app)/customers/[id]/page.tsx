import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatPhone, formatCurrency } from "@/lib/utils/format";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Edit, Phone, Mail, MapPin, Building2, FileText,
  Calendar, Receipt, ChevronRight, Plus
} from "lucide-react";
import type { Database } from "@/types/database";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("first_name, last_name").eq("id", id).single() as { data: Pick<CustomerRow, "first_name" | "last_name"> | null; error: unknown };
  return { title: data ? `${data.first_name} ${data.last_name}` : "Customer" };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single() as { data: CustomerRow | null; error: unknown };

  if (!customer) notFound();

  const [
    { data: properties },
    { data: estimates },
    { data: jobs },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("properties").select("id, property_name, address_line1, city, state, property_type, active").eq("customer_id", id).is("deleted_at", null).order("created_at"),
    supabase.from("estimates").select("id, estimate_number, title, status, total, issue_date").eq("customer_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("jobs").select("id, job_number, title, status, scheduled_date").eq("customer_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("invoices").select("id, invoice_number, status, total, balance_due, issue_date").eq("customer_id", id).order("created_at", { ascending: false }).limit(5),
  ]);

  const totalBilled = invoices?.reduce((sum, inv) => sum + inv.total, 0) ?? 0;
  const totalBalance = invoices?.reduce((sum, inv) => sum + inv.balance_due, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/customers" className="text-sm text-muted hover:text-charcoal">Customers</Link>
            <ChevronRight size={14} className="text-muted" />
            <span className="text-sm text-charcoal font-medium">{customer.first_name} {customer.last_name}</span>
          </div>
          <h1 className="text-2xl font-bold text-charcoal">
            {customer.first_name} {customer.last_name}
          </h1>
          {customer.business_name && <p className="text-muted">{customer.business_name}</p>}
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge label={customer.status} variant={customer.status === "active" ? "green" : "gray"} />
            <StatusBadge label={customer.account_type} variant="blue" />
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href={`/customers/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit size={15} />
            Edit
          </Link>
          <Link
            href={`/estimates/new?customerId=${id}`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-redline text-white rounded-lg hover:bg-redline-dark transition-colors"
          >
            <Plus size={15} />
            New Estimate
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-charcoal">Contact Information</h2>
            {customer.email && (
              <div className="flex items-start gap-3">
                <Mail size={16} className="text-muted mt-0.5 flex-shrink-0" />
                <a href={`mailto:${customer.email}`} className="text-sm text-charcoal hover:text-redline">{customer.email}</a>
              </div>
            )}
            {customer.mobile_phone && (
              <div className="flex items-start gap-3">
                <Phone size={16} className="text-muted mt-0.5 flex-shrink-0" />
                <a href={`tel:${customer.mobile_phone}`} className="text-sm text-charcoal hover:text-redline">{formatPhone(customer.mobile_phone)}</a>
              </div>
            )}
            {(customer.billing_address_line1 || customer.billing_city) && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-muted mt-0.5 flex-shrink-0" />
                <div className="text-sm text-charcoal">
                  {customer.billing_address_line1 && <p>{customer.billing_address_line1}</p>}
                  {(customer.billing_city || customer.billing_state) && (
                    <p>{[customer.billing_city, customer.billing_state, customer.billing_zip].filter(Boolean).join(", ")}</p>
                  )}
                </div>
              </div>
            )}
            {customer.preferred_contact && (
              <p className="text-xs text-muted">Prefers: <span className="text-charcoal capitalize">{customer.preferred_contact}</span></p>
            )}
            {customer.customer_source && (
              <p className="text-xs text-muted">Source: <span className="text-charcoal capitalize">{customer.customer_source.replace(/_/g, " ")}</span></p>
            )}
          </div>

          {/* Account Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-charcoal">Account Summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total Billed</span>
              <span className="font-semibold text-charcoal">{formatCurrency(totalBilled)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Balance Due</span>
              <span className={`font-semibold ${totalBalance > 0 ? "text-redline" : "text-lawn"}`}>
                {formatCurrency(totalBalance)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Properties</span>
              <span className="font-semibold">{properties?.length ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total Jobs</span>
              <span className="font-semibold">{jobs?.length ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Customer Since</span>
              <span className="font-semibold">{formatDate(customer.created_at)}</span>
            </div>
          </div>

          {/* Notes */}
          {customer.internal_notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-yellow-800 mb-1">Internal Notes</h2>
              <p className="text-sm text-yellow-700 whitespace-pre-line">{customer.internal_notes}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Properties */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-charcoal flex items-center gap-2">
                <Building2 size={16} className="text-lawn" />
                Properties ({properties?.length ?? 0})
              </h2>
              <Link href={`/properties/new?customerId=${id}`} className="text-xs text-redline hover:underline flex items-center gap-1">
                <Plus size={12} /> Add Property
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(properties?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted px-5 py-4">No properties added yet.</p>
              ) : properties?.map(prop => (
                <Link key={prop.id} href={`/properties/${prop.id}`} className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{prop.property_name ?? prop.address_line1}</p>
                      <p className="text-xs text-muted">{prop.city}, {prop.state} · {prop.property_type}</p>
                    </div>
                    <StatusBadge label={prop.active ? "Active" : "Inactive"} variant={prop.active ? "green" : "gray"} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Estimates */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-charcoal flex items-center gap-2">
                <FileText size={16} className="text-blue-600" />
                Recent Estimates
              </h2>
              <Link href={`/estimates?customerId=${id}`} className="text-xs text-redline hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(estimates?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted px-5 py-4">No estimates yet.</p>
              ) : estimates?.map(est => (
                <Link key={est.id} href={`/estimates/${est.id}`} className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{est.estimate_number} — {est.title}</p>
                      <p className="text-xs text-muted">{formatDate(est.issue_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(est.total)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-charcoal flex items-center gap-2">
                <Calendar size={16} className="text-orange-600" />
                Recent Jobs
              </h2>
              <Link href={`/jobs?customerId=${id}`} className="text-xs text-redline hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(jobs?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted px-5 py-4">No jobs yet.</p>
              ) : jobs?.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{job.job_number} — {job.title}</p>
                      <p className="text-xs text-muted">{job.scheduled_date ? formatDate(job.scheduled_date) : "Not scheduled"}</p>
                    </div>
                    <StatusBadge
                      label={job.status.replace(/_/g, " ")}
                      variant={job.status === "completed" ? "green" : job.status === "cancelled" ? "gray" : "blue"}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-charcoal flex items-center gap-2">
                <Receipt size={16} className="text-charcoal" />
                Recent Invoices
              </h2>
              <Link href={`/invoices?customerId=${id}`} className="text-xs text-redline hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(invoices?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted px-5 py-4">No invoices yet.</p>
              ) : invoices?.map(inv => (
                <Link key={inv.id} href={`/invoices/${inv.id}`} className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{inv.invoice_number}</p>
                      <p className="text-xs text-muted">{formatDate(inv.issue_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(inv.total)}</p>
                      {inv.balance_due > 0 && (
                        <p className="text-xs text-redline">Balance: {formatCurrency(inv.balance_due)}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
