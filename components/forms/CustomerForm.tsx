"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer";
import { createCustomer, updateCustomer } from "@/lib/actions/customers";
import type { Customer } from "@/types/database";
import { Loader2 } from "lucide-react";

interface Props {
  customer?: Customer;
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

const fieldClass = "block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors";
const labelClass = "block text-sm font-medium text-charcoal mb-1";
const errorClass = "mt-1 text-xs text-red-600";

export default function CustomerForm({ customer }: Props) {
  const router = useRouter();
  const isEdit = !!customer;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema) as unknown as Resolver<CustomerInput>,
    defaultValues: customer ? {
      accountType: customer.account_type as "individual" | "business",
      firstName: customer.first_name,
      lastName: customer.last_name,
      businessName: customer.business_name ?? "",
      email: customer.email,
      mobilePhone: customer.mobile_phone ?? "",
      alternatePhone: customer.alternate_phone ?? "",
      billingAddressLine1: customer.billing_address_line1 ?? "",
      billingCity: customer.billing_city ?? "",
      billingState: customer.billing_state ?? "",
      billingZip: customer.billing_zip ?? "",
      preferredContact: customer.preferred_contact as "email" | "phone" | "text" | null,
      customerSource: customer.customer_source ?? "",
      taxExempt: customer.tax_exempt,
      internalNotes: customer.internal_notes ?? "",
      portalAccess: customer.portal_access,
      tags: customer.tags ?? [],
    } : {
      accountType: "individual",
      taxExempt: false,
      portalAccess: false,
      tags: [],
    },
  });

  const accountType = watch("accountType");
  const taxExempt = watch("taxExempt");

  async function onSubmit(data: CustomerInput) {
    const result = isEdit
      ? await updateCustomer(customer!.id, data)
      : await createCustomer(data);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Customer updated" : "Customer created");
    router.push(`/customers/${result.id ?? customer?.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Account Type */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="text-base font-semibold text-charcoal">Account Information</h2>

        <div>
          <label className={labelClass}>Account Type</label>
          <div className="flex gap-4">
            {(["individual", "business"] as const).map(type => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value={type}
                  {...register("accountType")}
                  className="text-redline focus:ring-redline"
                />
                <span className="text-sm capitalize">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {accountType === "business" && (
          <div>
            <label htmlFor="businessName" className={labelClass}>Business Name</label>
            <input id="businessName" {...register("businessName")} className={fieldClass} placeholder="Company LLC" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className={labelClass}>First Name <span className="text-redline">*</span></label>
            <input id="firstName" {...register("firstName")} className={fieldClass} placeholder="First name" />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label htmlFor="lastName" className={labelClass}>Last Name <span className="text-redline">*</span></label>
            <input id="lastName" {...register("lastName")} className={fieldClass} placeholder="Last name" />
            {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className={labelClass}>Email <span className="text-redline">*</span></label>
            <input id="email" type="email" {...register("email")} className={fieldClass} placeholder="email@example.com" />
            {errors.email && <p className={errorClass}>{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="mobilePhone" className={labelClass}>Mobile Phone</label>
            <input id="mobilePhone" type="tel" {...register("mobilePhone")} className={fieldClass} placeholder="(606) 555-1234" />
            {errors.mobilePhone && <p className={errorClass}>{errors.mobilePhone.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="alternatePhone" className={labelClass}>Alternate Phone</label>
            <input id="alternatePhone" type="tel" {...register("alternatePhone")} className={fieldClass} placeholder="Optional" />
          </div>
          <div>
            <label htmlFor="preferredContact" className={labelClass}>Preferred Contact</label>
            <select id="preferredContact" {...register("preferredContact")} className={fieldClass}>
              <option value="">No preference</option>
              <option value="email">Email</option>
              <option value="phone">Phone call</option>
              <option value="text">Text message</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="customerSource" className={labelClass}>Lead Source</label>
          <select id="customerSource" {...register("customerSource")} className={fieldClass}>
            <option value="">Select source</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="google">Google</option>
            <option value="facebook">Facebook</option>
            <option value="nextdoor">Nextdoor</option>
            <option value="phone">Phone call</option>
            <option value="walk_in">Walk-in</option>
            <option value="returning">Returning customer</option>
            <option value="other">Other</option>
          </select>
        </div>
      </section>

      {/* Billing Address */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-charcoal">Billing Address</h2>
        <div>
          <label htmlFor="billingAddressLine1" className={labelClass}>Address Line 1</label>
          <input id="billingAddressLine1" {...register("billingAddressLine1")} className={fieldClass} placeholder="123 Main St" />
        </div>
        <div>
          <label htmlFor="billingAddressLine2" className={labelClass}>Address Line 2</label>
          <input id="billingAddressLine2" {...register("billingAddressLine2")} className={fieldClass} placeholder="Apt, Suite, etc." />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="billingCity" className={labelClass}>City</label>
            <input id="billingCity" {...register("billingCity")} className={fieldClass} placeholder="Lexington" />
          </div>
          <div>
            <label htmlFor="billingState" className={labelClass}>State</label>
            <select id="billingState" {...register("billingState")} className={fieldClass}>
              <option value="">ST</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="billingZip" className={labelClass}>ZIP</label>
            <input id="billingZip" {...register("billingZip")} className={fieldClass} placeholder="40502" />
            {errors.billingZip && <p className={errorClass}>{errors.billingZip.message}</p>}
          </div>
        </div>
      </section>

      {/* Tax & Portal */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-charcoal">Tax & Portal</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" {...register("taxExempt")} className="h-4 w-4 rounded text-redline focus:ring-redline" />
          <span className="text-sm text-charcoal">This customer is tax-exempt</span>
        </label>
        {taxExempt && (
          <div>
            <label htmlFor="taxExemptionId" className={labelClass}>Tax Exemption ID</label>
            <input id="taxExemptionId" {...register("taxExemptionId")} className={fieldClass} placeholder="Exemption certificate number" />
          </div>
        )}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" {...register("portalAccess")} className="h-4 w-4 rounded text-redline focus:ring-redline" />
          <span className="text-sm text-charcoal">Enable customer portal access</span>
        </label>
      </section>

      {/* Notes */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-charcoal">Internal Notes</h2>
        <textarea
          {...register("internalNotes")}
          rows={4}
          className={`${fieldClass} resize-y`}
          placeholder="Internal notes about this customer (not visible to them)…"
        />
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-redline text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}
          {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Customer"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 text-sm font-medium text-charcoal hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
