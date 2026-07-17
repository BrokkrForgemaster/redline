"use client";

import { useForm } from "react-hook-form";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateBusinessSettings } from "@/lib/actions/settings";
import { Loader2 } from "lucide-react";

interface InvoicingSettings {
  default_tax_rate?: number;
  default_payment_terms?: number;
  estimate_expiration_days?: number;
  default_deposit_percent?: number;
  estimate_prefix?: string;
  invoice_prefix?: string;
  contract_prefix?: string;
  job_prefix?: string;
  po_prefix?: string;
  snow_event_prefix?: string;
  pdf_footer?: string;
}

interface Props {
  settings: InvoicingSettings;
}

export default function InvoicingSettingsForm({ settings }: Props) {
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit } = useForm<InvoicingSettings>({
    defaultValues: {
      default_tax_rate: settings.default_tax_rate ?? 0,
      default_payment_terms: settings.default_payment_terms ?? 30,
      estimate_expiration_days: settings.estimate_expiration_days ?? 30,
      default_deposit_percent: settings.default_deposit_percent ?? 0,
      estimate_prefix: settings.estimate_prefix ?? "EST",
      invoice_prefix: settings.invoice_prefix ?? "INV",
      contract_prefix: settings.contract_prefix ?? "CON",
      job_prefix: settings.job_prefix ?? "JOB",
      po_prefix: settings.po_prefix ?? "PO",
      snow_event_prefix: settings.snow_event_prefix ?? "SNW",
      pdf_footer: settings.pdf_footer ?? "",
    },
  });

  const onSubmit = (data: InvoicingSettings) => {
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
      {/* Tax & Payments */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Tax & Payment Defaults</h2>
        <div className="grid grid-cols-2 gap-4">
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
            <label className="block text-sm font-medium text-charcoal mb-1">Payment Terms (days)</label>
            <input
              {...register("default_payment_terms", { valueAsNumber: true })}
              type="number"
              min="0"
              step="1"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Estimate Expiration (days)</label>
            <input
              {...register("estimate_expiration_days", { valueAsNumber: true })}
              type="number"
              min="1"
              step="1"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Default Deposit (%)</label>
            <input
              {...register("default_deposit_percent", { valueAsNumber: true })}
              type="number"
              min="0"
              max="100"
              step="1"
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Document Prefixes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">Document Number Prefixes</h2>
        <p className="text-sm text-muted -mt-3">
          These prefixes are used when generating document numbers (e.g. EST-0001).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Estimate</label>
            <input
              {...register("estimate_prefix")}
              type="text"
              maxLength={10}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Invoice</label>
            <input
              {...register("invoice_prefix")}
              type="text"
              maxLength={10}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Contract</label>
            <input
              {...register("contract_prefix")}
              type="text"
              maxLength={10}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Job</label>
            <input
              {...register("job_prefix")}
              type="text"
              maxLength={10}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Purchase Order</label>
            <input
              {...register("po_prefix")}
              type="text"
              maxLength={10}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Snow Event</label>
            <input
              {...register("snow_event_prefix")}
              type="text"
              maxLength={10}
              className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* PDF Footer */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">PDF Footer</h2>
        <p className="text-sm text-muted -mt-2">Appears at the bottom of all generated PDFs.</p>
        <textarea
          {...register("pdf_footer")}
          rows={4}
          className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
          placeholder="Thank you for your business! Payment is due within 30 days…"
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
