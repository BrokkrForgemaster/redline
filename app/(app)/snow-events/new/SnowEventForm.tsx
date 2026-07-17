"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { createSnowEvent } from "@/lib/actions/snow-events";
import { Loader2 } from "lucide-react";

const snowEventSchema = z.object({
  eventName: z.string().min(1, "Event name is required"),
  forecastStart: z.string().optional(),
  forecastEnd: z.string().optional(),
  expectedSnowfallInches: z.number().min(0).optional().nullable(),
  iceRisk: z.boolean().default(false),
  temperatureLow: z.number().optional().nullable(),
  weatherNotes: z.string().max(2000).optional(),
  operationalPriority: z.enum(["low", "normal", "high", "emergency"]).default("normal"),
  eventNotes: z.string().max(5000).optional(),
});

type SnowEventFormData = z.infer<typeof snowEventSchema>;

const fieldClass = "block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";
const labelClass = "block text-sm font-medium text-charcoal mb-1";
const errorClass = "mt-1 text-xs text-red-600";

export default function SnowEventForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SnowEventFormData>({
    resolver: zodResolver(snowEventSchema) as unknown as Resolver<SnowEventFormData>,
    defaultValues: {
      operationalPriority: "normal",
      iceRisk: false,
    },
  });

  async function onSubmit(data: SnowEventFormData) {
    const result = await createSnowEvent({
      eventName: data.eventName,
      forecastStart: data.forecastStart || null,
      forecastEnd: data.forecastEnd || null,
      expectedSnowfallInches: data.expectedSnowfallInches ?? null,
      iceRisk: data.iceRisk,
      temperatureLow: data.temperatureLow ?? null,
      weatherNotes: data.weatherNotes || null,
      operationalPriority: data.operationalPriority,
      eventNotes: data.eventNotes || null,
      managerId: null,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Snow event created");
    router.push(`/snow-events/${result.id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Event Information</h2>

        <div>
          <label className={labelClass}>Event Name <span className="text-redline">*</span></label>
          <input {...register("eventName")} className={fieldClass} placeholder="e.g. Winter Storm Jan 15" />
          {errors.eventName && <p className={errorClass}>{errors.eventName.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Operational Priority</label>
          <select {...register("operationalPriority")} className={fieldClass}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Forecast</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Forecast Start</label>
            <input {...register("forecastStart")} type="datetime-local" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Forecast End</label>
            <input {...register("forecastEnd")} type="datetime-local" className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Expected Snowfall (inches)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className={fieldClass}
              placeholder="e.g. 4.0"
              onChange={e => {
                const val = parseFloat(e.target.value);
                setValue("expectedSnowfallInches", isNaN(val) ? null : val);
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Low Temperature (&deg;F)</label>
            <input
              type="number"
              className={fieldClass}
              placeholder="e.g. 28"
              onChange={e => {
                const val = parseFloat(e.target.value);
                setValue("temperatureLow", isNaN(val) ? null : val);
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="iceRisk"
            {...register("iceRisk")}
            className="h-4 w-4 rounded border-gray-300 text-redline focus:ring-redline"
          />
          <label htmlFor="iceRisk" className="text-sm font-medium text-charcoal cursor-pointer">
            Ice risk expected — salt/treatment required
          </label>
        </div>

        <div>
          <label className={labelClass}>Weather Notes</label>
          <textarea {...register("weatherNotes")} rows={3} className={fieldClass} placeholder="Additional weather details, NWS links, radar notes…" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">Operational Notes</h2>
        <div>
          <label className={labelClass}>Event Notes</label>
          <textarea {...register("eventNotes")} rows={4} className={fieldClass} placeholder="Internal notes for the operations team…" />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
        >
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}
          {isSubmitting ? "Creating…" : "Create Snow Event"}
        </button>
        <a href="/snow-events" className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </a>
      </div>
    </form>
  );
}
