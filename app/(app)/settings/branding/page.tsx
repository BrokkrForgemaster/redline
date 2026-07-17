import { createClient } from "@/lib/supabase/server";
import BrandingEditForm from "./BrandingEditForm";
import { ImageIcon } from "lucide-react";
import type { BusinessSettings } from "@/types/database";

export const metadata = { title: "Branding & PDFs" };

export default async function BrandingPage() {
  const supabase = await createClient();
  const { data: rawSettings } = await supabase
    .from("business_settings")
    .select("logo_url, pdf_footer, terms_and_conditions, business_name")
    .limit(1)
    .single();

  const settings = rawSettings as unknown as Pick<BusinessSettings, "logo_url" | "pdf_footer" | "terms_and_conditions" | "business_name"> | null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Branding & PDFs</h1>
        <p className="text-sm text-muted mt-1">
          Manage your logo, brand colors, and PDF document appearance.
        </p>
      </div>

      {/* Logo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">Company Logo</h2>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
            {settings?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo_url}
                alt={settings.business_name ?? "Business logo"}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <ImageIcon size={32} className="text-gray-300" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-charcoal">
              {settings?.logo_url ? "Logo uploaded" : "No logo uploaded"}
            </p>
            <p className="text-xs text-muted leading-relaxed">
              To upload a logo, configure a Supabase Storage bucket named{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">logos</code> with public access.
              Recommended size: 400×200px PNG or SVG.
            </p>
          </div>
        </div>
      </div>

      {/* Brand Colors */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-charcoal">Brand Colors</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0"
              style={{ backgroundColor: "#B11226" }}
            />
            <div>
              <p className="text-sm font-medium text-charcoal">Redline Red</p>
              <p className="text-xs text-muted">#B11226 — Primary brand color</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0"
              style={{ backgroundColor: "#1a1a1a" }}
            />
            <div>
              <p className="text-sm font-medium text-charcoal">Charcoal</p>
              <p className="text-xs text-muted">#1a1a1a — Text / dark</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted">
          Brand colors are configured in your Tailwind theme. Contact your developer to adjust colors.
        </p>
      </div>

      {/* PDF Footer & Terms edit form */}
      <BrandingEditForm
        pdfFooter={settings?.pdf_footer ?? ""}
        termsAndConditions={settings?.terms_and_conditions ?? ""}
      />
    </div>
  );
}
