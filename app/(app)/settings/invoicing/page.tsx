import { createClient } from "@/lib/supabase/server";
import InvoicingSettingsForm from "./InvoicingSettingsForm";

export const metadata = { title: "Invoicing & Taxes" };

export default async function InvoicingSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .single();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Invoicing & Taxes</h1>
        <p className="text-sm text-muted mt-1">
          Configure document prefixes, tax rates, and payment defaults.
        </p>
      </div>
      <InvoicingSettingsForm settings={settings ?? {}} />
    </div>
  );
}
