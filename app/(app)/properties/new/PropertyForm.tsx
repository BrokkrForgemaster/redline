"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { propertySchema, type PropertyInput } from "@/lib/validations/customer";
import { createProperty } from "@/lib/actions/properties";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const fieldClass =
  "block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";
const labelClass = "block text-sm font-medium text-charcoal mb-1";
const errorClass = "mt-1 text-xs text-red-600";

interface Props {
  customers: { id: string; first_name: string; last_name: string; business_name: string | null }[];
  defaultCustomerId?: string;
}

export default function PropertyForm({ customers, defaultCustomerId }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PropertyInput>({
    resolver: zodResolver(propertySchema) as unknown as Resolver<PropertyInput>,
    defaultValues: {
      customerId: defaultCustomerId ?? "",
      propertyType: "residential",
      active: true,
      petsOnProperty: false,
    },
  });

  async function onSubmit(data: PropertyInput) {
    const result = await createProperty(data);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Property created");
    router.push(`/properties/${result.id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Customer & Basic Info */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-charcoal">Property Details</h2>

        <div>
          <label htmlFor="customerId" className={labelClass}>
            Customer <span className="text-redline">*</span>
          </label>
          <select id="customerId" {...register("customerId")} className={fieldClass}>
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
                {c.business_name ? ` — ${c.business_name}` : ""}
              </option>
            ))}
          </select>
          {errors.customerId && (
            <p className={errorClass}>{errors.customerId.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="propertyName" className={labelClass}>
            Property Name{" "}
            <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id="propertyName"
            {...register("propertyName")}
            className={fieldClass}
            placeholder="e.g. Main Residence, Office Building"
          />
        </div>

        <div>
          <label htmlFor="propertyType" className={labelClass}>
            Property Type <span className="text-redline">*</span>
          </label>
          <select id="propertyType" {...register("propertyType")} className={fieldClass}>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>
      </section>

      {/* Address */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-charcoal">Address</h2>

        <div>
          <label htmlFor="addressLine1" className={labelClass}>
            Address Line 1 <span className="text-redline">*</span>
          </label>
          <input
            id="addressLine1"
            {...register("addressLine1")}
            className={fieldClass}
            placeholder="123 Main St"
          />
          {errors.addressLine1 && (
            <p className={errorClass}>{errors.addressLine1.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="addressLine2" className={labelClass}>
            Address Line 2
          </label>
          <input
            id="addressLine2"
            {...register("addressLine2")}
            className={fieldClass}
            placeholder="Apt, Suite, Unit, etc."
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="city" className={labelClass}>
              City <span className="text-redline">*</span>
            </label>
            <input
              id="city"
              {...register("city")}
              className={fieldClass}
              placeholder="Lexington"
            />
            {errors.city && <p className={errorClass}>{errors.city.message}</p>}
          </div>
          <div>
            <label htmlFor="state" className={labelClass}>
              State <span className="text-redline">*</span>
            </label>
            <select id="state" {...register("state")} className={fieldClass}>
              <option value="">ST</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {errors.state && <p className={errorClass}>{errors.state.message}</p>}
          </div>
          <div>
            <label htmlFor="zip" className={labelClass}>
              ZIP <span className="text-redline">*</span>
            </label>
            <input
              id="zip"
              {...register("zip")}
              className={fieldClass}
              placeholder="40502"
            />
            {errors.zip && <p className={errorClass}>{errors.zip.message}</p>}
          </div>
        </div>
      </section>

      {/* Measurements */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-charcoal">Measurements</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lotSizeSqft" className={labelClass}>
              Lot Size (sq ft)
            </label>
            <input
              id="lotSizeSqft"
              type="number"
              min={0}
              {...register("lotSizeSqft", { valueAsNumber: true })}
              className={fieldClass}
              placeholder="e.g. 8500"
            />
          </div>
          <div>
            <label htmlFor="turfAreaSqft" className={labelClass}>
              Turf Area (sq ft)
            </label>
            <input
              id="turfAreaSqft"
              type="number"
              min={0}
              {...register("turfAreaSqft", { valueAsNumber: true })}
              className={fieldClass}
              placeholder="e.g. 5000"
            />
          </div>
        </div>
      </section>

      {/* Access & Notes */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-charcoal">Access & Notes</h2>

        <div>
          <label htmlFor="accessInstructions" className={labelClass}>
            Access Instructions
          </label>
          <textarea
            id="accessInstructions"
            {...register("accessInstructions")}
            rows={3}
            className={`${fieldClass} resize-y`}
            placeholder="Gate codes, entry notes, parking instructions…"
          />
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("petsOnProperty")}
              className="h-4 w-4 rounded text-redline focus:ring-redline"
            />
            <span className="text-sm text-charcoal">Pets on property</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("active")}
              className="h-4 w-4 rounded text-redline focus:ring-redline"
            />
            <span className="text-sm text-charcoal">Property is active</span>
          </label>
        </div>

        <div>
          <label htmlFor="propertyNotes" className={labelClass}>
            Property Notes
          </label>
          <textarea
            id="propertyNotes"
            {...register("propertyNotes")}
            rows={4}
            className={`${fieldClass} resize-y`}
            placeholder="Additional notes about this property…"
          />
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-redline text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}
          {isSubmitting ? "Saving…" : "Create Property"}
        </button>
        <a
          href="/properties"
          className="px-6 py-2.5 text-sm font-medium text-charcoal hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
