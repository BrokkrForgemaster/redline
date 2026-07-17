"use client";

import { useForm } from "react-hook-form";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateBusinessSettings } from "@/lib/actions/settings";
import { Loader2 } from "lucide-react";

interface Props {
  pdfFooter: string;
  termsAndConditions: string;
}

interface FormValues {
  pdf_footer: string;
  terms_and_conditions: string;
}

export default function BrandingEditForm({ pdfFooter, termsAndConditions }: Props) {
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      pdf_footer: pdfFooter,
      terms_and_conditions: termsAndConditions,
    },
  });

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const result = await updateBusinessSettings(data as unknown as Record<string, unknown>);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Settings saved");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">PDF Footer</h2>
        <p className="text-sm text-muted -mt-2">
          This text appears at the bottom of all generated PDF documents.
        </p>
        <textarea
          {...register("pdf_footer")}
          rows={3}
          className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
          placeholder="Thank you for your business!"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">Terms & Conditions</h2>
        <p className="text-sm text-muted -mt-2">
          These terms appear on estimates, contracts, and invoices.
        </p>
        <textarea
          {...register("terms_and_conditions")}
          rows={6}
          className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
          placeholder="Payment is due within 30 days of invoice date…"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors disabled:opacity-60"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          Save Changes
        </button>
      </div>
    </form>
  );
}
