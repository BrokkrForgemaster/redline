import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireStaffUser } from "@/lib/api/auth";
import JobForm from "../../new/JobForm";
import type { JobInput } from "@/lib/validations/job";
import { loadJobCrewOptions } from "@/lib/jobs/crew-options";

export const metadata: Metadata = { title: "Edit Job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const access = await requireStaffUser("reviewer");
  if (!access.ok) notFound();

  const [{ data: job, error: jobError }, customersResult, crewsResult] = await Promise.all([
    access.supabase.from("jobs").select(`id, job_number, customer_id, property_id,
      estimate_id, contract_id, service_type, priority, title, description,
      crew_id, scheduled_date, scheduled_start, scheduled_end, estimated_hours,
      work_instructions, access_notes, is_recurring, recurrence_rule`)
      .eq("id", id).single(),
    access.supabase.from("customers")
      .select("id, first_name, last_name, business_name, account_type")
      .eq("status", "active").is("deleted_at", null).order("last_name"),
    loadJobCrewOptions(access.supabase),
  ]);
  if (!job && jobError?.code === "PGRST116") notFound();
  if (jobError || customersResult.error) {
    throw new Error("Job editor could not be loaded. Please retry.");
  }
  if (!job) notFound();

  const initialJob: JobInput & { id: string } = {
    id: job.id,
    customerId: job.customer_id,
    propertyId: job.property_id,
    estimateId: job.estimate_id,
    contractId: job.contract_id,
    serviceType: job.service_type,
    priority: job.priority,
    title: job.title,
    description: job.description,
    crewId: job.crew_id,
    scheduledDate: job.scheduled_date,
    scheduledStart: job.scheduled_start,
    scheduledEnd: job.scheduled_end,
    estimatedHours: job.estimated_hours,
    workInstructions: job.work_instructions,
    accessNotes: job.access_notes,
    isRecurring: job.is_recurring,
    recurrenceRule: job.recurrence_rule,
  };

  return <div className="max-w-2xl pb-8">
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <Link href="/jobs" className="text-sm text-muted hover:text-charcoal">Jobs</Link>
        <ChevronRight size={14} className="text-muted" />
        <Link href={`/jobs/${id}`} className="text-sm text-muted hover:text-charcoal">{job.job_number}</Link>
        <ChevronRight size={14} className="text-muted" />
        <span className="text-sm font-medium text-charcoal">Edit</span>
      </div>
      <h1 className="text-2xl font-bold text-charcoal">Edit {job.job_number}</h1>
      <p className="mt-1 text-sm text-muted">Update job details, schedule, and assigned crew.</p>
    </div>
    <JobForm customers={customersResult.data ?? []} crews={crewsResult} job={initialJob} />
  </div>;
}
