"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { createLead } from "@/lib/actions/leads";
import { Loader2 } from "lucide-react";

const leadSchema = z.object({
  source: z.string().min(1, "Source is required"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  companyName: z.string().max(200).optional(),
  serviceAddress: z.string().max(500).optional(),
  requestedServices: z.array(z.string()).default([]),
  followUpDate: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

const fieldClass = "block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";
const labelClass = "block text-sm font-medium text-charcoal mb-1";
const errorClass = "mt-1 text-xs text-red-600";

const SERVICE_OPTIONS = [
  { value: "lawn_mowing", label: "Lawn Mowing" },
  { value: "landscaping", label: "Landscaping" },
  { value: "aeration_overseeding", label: "Aeration & Overseeding" },
  { value: "snow_removal", label: "Snow Removal" },
  { value: "spring_cleanup", label: "Spring Cleanup" },
  { value: "fall_cleanup", label: "Fall Cleanup" },
  { value: "mulching", label: "Mulching" },
  { value: "other", label: "Other" },
];

export default function LeadForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema) as unknown as Resolver<LeadFormData>,
    defaultValues: {
      source: "",
      requestedServices: [],
    },
  });

  const selectedServices = watch("requestedServices") ?? [];

  function toggleService(value: string) {
    const current = selectedServices;
    if (current.includes(value)) {
      setValue("requestedServices", current.filter(s => s !== value));
    } else {
      setValue("requestedServices", [...current, value]);
    }
  }

  async function onSubmit(data: LeadFormData) {
    const result = await createLead({
      source: data.source,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone || null,
      companyName: data.companyName || null,
      serviceAddress: data.serviceAddress || null,
      requestedServices: data.requestedServices,
      followUpDate: data.followUpDate || null,
      notes: data.notes || null,
      assignedTo: null,
      lossReason: null,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Lead created");
    router.push(`/leads/${result.id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Lead Information</h2>

        <div>
          <label className={labelClass}>Source <span className="text-redline">*</span></label>
          <select {...register("source")} className={fieldClass}>
            <option value="">Select source…</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="facebook">Facebook</option>
            <option value="google">Google</option>
            <option value="door_to_door">Door to Door</option>
            <option value="yard_sign">Yard Sign</option>
            <option value="repeat_customer">Repeat Customer</option>
            <option value="other">Other</option>
          </select>
          {errors.source && <p className={errorClass}>{errors.source.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>First Name <span className="text-redline">*</span></label>
            <input {...register("firstName")} className={fieldClass} placeholder="Jane" />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Last Name <span className="text-redline">*</span></label>
            <input {...register("lastName")} className={fieldClass} placeholder="Smith" />
            {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Email</label>
            <input {...register("email")} type="email" className={fieldClass} placeholder="jane@example.com" />
            {errors.email && <p className={errorClass}>{errors.email.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input {...register("phone")} type="tel" className={fieldClass} placeholder="(555) 000-0000" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Company Name</label>
          <input {...register("companyName")} className={fieldClass} placeholder="Optional" />
        </div>

        <div>
          <label className={labelClass}>Service Address</label>
          <input {...register("serviceAddress")} className={fieldClass} placeholder="123 Main St, City, MI 49000" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">Requested Services</h2>
        <div className="grid grid-cols-2 gap-3">
          {SERVICE_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedServices.includes(opt.value)}
                onChange={() => toggleService(opt.value)}
                className="h-4 w-4 rounded border-gray-300 text-redline focus:ring-redline"
              />
              <span className="text-sm text-charcoal">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Follow Up &amp; Notes</h2>

        <div>
          <label className={labelClass}>Follow Up Date</label>
          <input {...register("followUpDate")} type="date" className={fieldClass} />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea {...register("notes")} rows={4} className={fieldClass} placeholder="Any additional notes about this lead…" />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
        >
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}
          {isSubmitting ? "Creating…" : "Create Lead"}
        </button>
        <a href="/leads" className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </a>
      </div>
    </form>
  );
}
