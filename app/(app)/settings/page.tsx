import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Shield, Bell, Users, DollarSign, Palette } from "lucide-react";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "owner" || profile?.role === "administrator";

  const { data: settings } = await supabase.from("business_settings").select("*").single();

  const sections = [
    { icon: Building2, label: "Business Information", description: "Name, address, logo, tax ID", href: "/settings/business", adminOnly: true },
    { icon: Palette, label: "Branding & PDFs", description: "Logo, colors, PDF footer, terms", href: "/settings/branding", adminOnly: true },
    { icon: DollarSign, label: "Invoicing & Taxes", description: "Tax rates, payment terms, prefixes", href: "/settings/invoicing", adminOnly: true },
    { icon: Users, label: "Roles & Permissions", description: "Manage employee roles", href: "/settings/roles", adminOnly: true },
    { icon: Bell, label: "Notifications", description: "Configure notifications", href: "/settings/notifications", adminOnly: false },
    { icon: Shield, label: "Security & MFA", description: "Password, MFA, sessions", href: "/settings/security", adminOnly: false },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Settings</h1>
        <p className="text-sm text-muted mt-1">Manage your business configuration and account preferences.</p>
      </div>

      {settings && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-charcoal mb-1">{settings.business_name}</h2>
          {settings.city && <p className="text-sm text-muted">{settings.city}, {settings.state}</p>}
          {settings.phone && <p className="text-sm text-muted">{settings.phone}</p>}
        </div>
      )}

      <div className="grid gap-4">
        {sections.filter(s => !s.adminOnly || isAdmin).map(section => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-redline/10 transition-colors">
              <section.icon size={20} className="text-muted group-hover:text-redline transition-colors" />
            </div>
            <div>
              <p className="font-medium text-charcoal">{section.label}</p>
              <p className="text-sm text-muted">{section.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
