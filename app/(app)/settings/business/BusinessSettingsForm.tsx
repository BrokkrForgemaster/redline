"use client";

import { useForm } from "react-hook-form";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateBusinessSettings } from "@/lib/actions/settings";
import { Loader2 } from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
];

interface BusinessSettings {
  business_name?: string;
  legal_name?: string;
  phone?: string;
  email?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  tax_id?: string;
  default_tax_rate?: number;
  currency?: string;
  timezone?: string;
  terms_and_conditions?: string;
}

interface Props {
  settings: BusinessSettings;
}

export default function BusinessSettingsForm({ settings }: Props) {
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit } = useForm<BusinessSettings>({
    defaultValues: {
      business_name: settings.business_name ?? "",
      legal_name: settings.legal_name ?? "",
      phone: settings.phone ?? "",
      email: settings.email ?? "",
      website: settings.website ?? "",
      address_line1: settings.address_line1 ?? "",
      address_line2: settings.address_line2 ?? "",
      city: settings.city ?? "",
      state: settings.state ?? "",
      zip: settings.zip ?? "",
      tax_id: settings.tax_id ?? "",
      default_tax_rate: settings.default_tax_rate ?? 0,
      currency: settings.currency ?? "USD",
      timezone: settings.timezone ?? "America/Chicago",
      terms_and_conditions: settings.terms_and_conditions ?? "",
    },
  });

  const onSubmit = (data: BusinessSettings) => {
    startTransition(async () => {
      const result = await updateBusinessSettings(data as Record<string, unknown>);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Settings saved");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Business Identity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Business Identity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Business Name <span className="text-redline">*</span>
            </label>
            <input
              {...register("business_name", { required: true })}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Legal Name</label>
            <input
              {...register("legal_name")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Phone</label>
            <input
              {...register("phone")}
              type="tel"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Email</label>
            <input
              {...register("email")}
              type="email"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-charcoal mb-1">Website</label>
            <input
              {...register("website")}
              type="url"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="https://example.com"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Business Address</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-charcoal mb-1">Address Line 1</label>
            <input
              {...register("address_line1")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-charcoal mb-1">Address Line 2</label>
            <input
              {...register("address_line2")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="Suite, unit, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">City</label>
            <input
              {...register("city")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">State</label>
              <select
                {...register("state")}
                className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              >
                <option value="">—</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">ZIP</label>
              <input
                {...register("zip")}
                type="text"
                className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tax & Regional */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Tax & Regional</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Tax ID / EIN</label>
            <input
              {...register("tax_id")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="XX-XXXXXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Default Tax Rate (%)</label>
            <input
              {...register("default_tax_rate", { valueAsNumber: true })}
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Currency</label>
            <input
              {...register("currency")}
              type="text"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
              placeholder="USD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Timezone</label>
            <select
              {...register("timezone")}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">Terms & Conditions</h2>
        <textarea
          {...register("terms_and_conditions")}
          rows={6}
          className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
          placeholder="Standard terms and conditions that appear on estimates and invoices…"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          Save Settings
        </button>
      </div>
    </form>
  );
}
