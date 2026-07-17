import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils/format";
import StatusBadge, { jobStatusBadge } from "@/components/ui/StatusBadge";
import { Edit, ChevronRight, MapPin, Building2, Calendar, Plus } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("address_line1, property_name")
    .eq("id", id)
    .single();
  return { title: data?.property_name ?? data?.address_line1 ?? "Property" };
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select(
      "*, customers!customer_id(id, first_name, last_name, business_name)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!property) notFound();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, job_number, title, status, scheduled_date")
    .eq("property_id", id)
    .order("scheduled_date", { ascending: false })
    .limit(5);

  const customer = property.customers as {
    id: string;
    first_name: string;
    last_name: string;
    business_name: string | null;
  } | null;

  const displayName = property.property_name ?? property.address_line1;
  const cityState = [property.city, property.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/properties" className="text-sm text-muted hover:text-charcoal">
              Properties
            </Link>
            <ChevronRight size={14} className="text-muted" />
            <span className="text-sm text-charcoal font-medium">{displayName}</span>
          </div>
          <h1 className="text-2xl font-bold text-charcoal">{displayName}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {cityState && (
              <span className="inline-flex items-center gap-1 text-sm text-muted">
                <MapPin size={14} />
                {cityState}
              </span>
            )}
            <StatusBadge
              label={property.active ? "Active" : "Inactive"}
              variant={property.active ? "green" : "gray"}
            />
            <StatusBadge
              label={property.property_type}
              variant="blue"
            />
          </div>
        </div>
        <Link
          href={`/properties/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <Edit size={15} />
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-charcoal">Property Information</h2>

            {customer && (
              <div>
                <p className="text-xs text-muted uppercase font-medium mb-0.5">Customer</p>
                <Link
                  href={`/customers/${customer.id}`}
                  className="text-sm text-charcoal hover:text-redline font-medium"
                >
                  {customer.first_name} {customer.last_name}
                  {customer.business_name && (
                    <span className="text-muted font-normal"> — {customer.business_name}</span>
                  )}
                </Link>
              </div>
            )}

            <div>
              <p className="text-xs text-muted uppercase font-medium mb-0.5">Address</p>
              <p className="text-sm text-charcoal">{property.address_line1}</p>
              {property.address_line2 && (
                <p className="text-sm text-charcoal">{property.address_line2}</p>
              )}
              <p className="text-sm text-charcoal">
                {[property.city, property.state, property.zip].filter(Boolean).join(", ")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted uppercase font-medium mb-0.5">Type</p>
                <p className="capitalize text-charcoal">{property.property_type}</p>
              </div>
              {property.lot_size_sqft != null && (
                <div>
                  <p className="text-xs text-muted uppercase font-medium mb-0.5">Lot Size</p>
                  <p className="text-charcoal">
                    {property.lot_size_sqft.toLocaleString()} sqft
                  </p>
                </div>
              )}
              {property.turf_area_sqft != null && (
                <div>
                  <p className="text-xs text-muted uppercase font-medium mb-0.5">Turf Area</p>
                  <p className="text-charcoal">
                    {property.turf_area_sqft.toLocaleString()} sqft
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted uppercase font-medium mb-0.5">Pets</p>
                <p className="text-charcoal">{property.pets_on_property ? "Yes" : "No"}</p>
              </div>
            </div>

            {property.access_instructions && (
              <div>
                <p className="text-xs text-muted uppercase font-medium mb-0.5">
                  Access Instructions
                </p>
                <p className="text-sm text-charcoal whitespace-pre-line">
                  {property.access_instructions}
                </p>
              </div>
            )}

            {property.property_notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-yellow-800 mb-1">Notes</p>
                <p className="text-sm text-yellow-700 whitespace-pre-line">
                  {property.property_notes}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs text-muted">
                Added {formatDate(property.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Jobs */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-charcoal flex items-center gap-2">
                <Calendar size={16} className="text-orange-600" />
                Recent Jobs
              </h2>
              <Link
                href={`/jobs/new?propertyId=${id}`}
                className="text-xs text-redline hover:underline flex items-center gap-1"
              >
                <Plus size={12} /> New Job
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {!jobs || jobs.length === 0 ? (
                <p className="text-sm text-muted px-5 py-4">No jobs for this property yet.</p>
              ) : (
                jobs.map((job) => {
                  const badge = jobStatusBadge(job.status);
                  return (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="block px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-charcoal">
                            {job.job_number} — {job.title}
                          </p>
                          <p className="text-xs text-muted">
                            {job.scheduled_date
                              ? formatDate(job.scheduled_date)
                              : "Not scheduled"}
                          </p>
                        </div>
                        <StatusBadge label={badge.label} variant={badge.variant} />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
            {jobs && jobs.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100">
                <Link
                  href={`/jobs?propertyId=${id}`}
                  className="text-xs text-redline hover:underline"
                >
                  View all jobs
                </Link>
              </div>
            )}
          </div>

          {/* Map placeholder / address display */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-charcoal flex items-center gap-2 mb-3">
              <Building2 size={16} className="text-lawn" />
              Location
            </h2>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(
                [property.address_line1, property.city, property.state, property.zip]
                  .filter(Boolean)
                  .join(", ")
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-redline hover:underline"
            >
              View on Google Maps →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
