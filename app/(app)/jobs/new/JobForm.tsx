"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { jobSchema, type JobInput } from "@/lib/validations/job";
import { createJob } from "@/lib/actions/jobs";
import { Loader2 } from "lucide-react";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  business_name: string | null;
  account_type: string;
}

interface Crew {
  id: string;
  name: string;
}

interface Property {
  id: string;
  address_line1: string;
  city: string;
  state: string;
  property_name: string | null;
}

interface Props {
  customers: Customer[];
  crews: Crew[];
}

const fieldClass = "block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";
const labelClass = "block text-sm font-medium text-charcoal mb-1";
const errorClass = "mt-1 text-xs text-red-600";

const SERVICE_TYPES = [
  { value: "lawn_mowing", label: "Lawn Mowing" },
  { value: "landscaping", label: "Landscaping" },
  { value: "aeration_overseeding", label: "Aeration & Overseeding" },
  { value: "snow_removal", label: "Snow Removal" },
  { value: "spring_cleanup", label: "Spring Cleanup" },
  { value: "fall_cleanup", label: "Fall Cleanup" },
  { value: "mulching", label: "Mulching" },
  { value: "irrigation", label: "Irrigation" },
  { value: "other", label: "Other" },
];

export default function JobForm({ customers, crews }: Props) {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JobInput>({
    resolver: zodResolver(jobSchema) as unknown as Resolver<JobInput>,
    defaultValues: {
      priority: "normal",
      isRecurring: false,
    },
  });

  const customerId = watch("customerId");
  const isRecurring = watch("isRecurring");

  useEffect(() => {
    if (!customerId) {
      setProperties([]);
      setValue("propertyId", null);
      return;
    }
    setLoadingProperties(true);
    const supabase = createClient();
    supabase
      .from("properties")
      .select("id, address_line1, city, state, property_name")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .eq("active", true)
      .order("address_line1")
      .then(({ data }) => {
        setProperties((data as Property[]) ?? []);
        setLoadingProperties(false);
      });
  }, [customerId, setValue]);

  async function onSubmit(data: JobInput) {
    const result = await createJob(data);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Job created");
    router.push(`/jobs/${result.id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Job Details</h2>

        <div>
          <label className={labelClass}>Customer <span className="text-redline">*</span></label>
          <select {...register("customerId")} className={fieldClass}>
            <option value="">Select customer…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.account_type === "business" && c.business_name
                  ? `${c.business_name} (${c.first_name} ${c.last_name})`
                  : `${c.first_name} ${c.last_name}`}
              </option>
            ))}
          </select>
          {errors.customerId && <p className={errorClass}>{errors.customerId.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Property</label>
          <select {...register("propertyId")} className={fieldClass} disabled={!customerId || loadingProperties}>
            <option value="">
              {loadingProperties ? "Loading properties…" : customerId ? "Select property (optional)" : "Select a customer first"}
            </option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {p.property_name ?? p.address_line1} — {p.city}, {p.state}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Service Type <span className="text-redline">*</span></label>
            <select {...register("serviceType")} className={fieldClass}>
              <option value="">Select service…</option>
              {SERVICE_TYPES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {errors.serviceType && <p className={errorClass}>{errors.serviceType.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Priority</label>
            <select {...register("priority")} className={fieldClass}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Title <span className="text-redline">*</span></label>
          <input {...register("title")} className={fieldClass} placeholder="e.g. Spring Lawn Mowing" />
          {errors.title && <p className={errorClass}>{errors.title.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea {...register("description")} rows={3} className={fieldClass} placeholder="Describe the work to be done…" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Scheduling</h2>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass} style={{ marginBottom: 0 }}>Crew</label>
            {crews.length === 0 && (
              <a href="/crews/new" target="_blank" rel="noopener noreferrer" className="text-xs text-redline hover:underline">
                + Create a crew first
              </a>
            )}
          </div>
          <select {...register("crewId")} className={fieldClass} disabled={crews.length === 0}>
            <option value="">{crews.length === 0 ? "No crews yet — create one first" : "Unassigned"}</option>
            {crews.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Scheduled Date</label>
            <input {...register("scheduledDate")} type="date" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Start Time</label>
            <input {...register("scheduledStart")} type="time" className={fieldClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Estimated Hours</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            className={fieldClass}
            placeholder="e.g. 2.5"
            onChange={e => {
              const val = parseFloat(e.target.value);
              setValue("estimatedHours", isNaN(val) ? null : val);
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isRecurring"
            {...register("isRecurring")}
            className="h-4 w-4 rounded border-gray-300 text-redline focus:ring-redline"
          />
          <label htmlFor="isRecurring" className="text-sm font-medium text-charcoal cursor-pointer">
            This is a recurring job
          </label>
        </div>

        {isRecurring && (
          <div>
            <label className={labelClass}>Recurrence Rule (RRULE)</label>
            <input {...register("recurrenceRule")} className={fieldClass} placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Instructions</h2>

        <div>
          <label className={labelClass}>Work Instructions</label>
          <textarea {...register("workInstructions")} rows={4} className={fieldClass} placeholder="Step-by-step instructions for the crew…" />
        </div>

        <div>
          <label className={labelClass}>Access Notes</label>
          <textarea {...register("accessNotes")} rows={3} className={fieldClass} placeholder="Gate codes, parking info, pet warnings…" />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
        >
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}
          {isSubmitting ? "Creating…" : "Create Job"}
        </button>
        <a href="/jobs" className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </a>
      </div>
    </form>
  );
}
