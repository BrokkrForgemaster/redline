import { createClient } from "@/lib/supabase/server";
import BusinessSettingsForm from "./BusinessSettingsForm";

export const metadata = { title: "Business Settings" };

export default async function BusinessSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .single();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Business Settings</h1>
        <p className="text-sm text-muted mt-1">
          Manage your business profile and contact information.
        </p>
      </div>
      <BusinessSettingsForm settings={settings ?? {}} />
    </div>
  );
}
