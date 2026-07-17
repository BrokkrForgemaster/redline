import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import LeadForm from "./LeadForm";

export const metadata: Metadata = { title: "New Lead" };

export default function NewLeadPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/leads" className="text-sm text-muted hover:text-charcoal">Leads</Link>
          <ChevronRight size={14} className="text-muted" />
          <span className="text-sm text-charcoal font-medium">New Lead</span>
        </div>
        <h1 className="text-2xl font-bold text-charcoal">New Lead</h1>
        <p className="text-sm text-muted mt-1">Capture a new lead to track through the sales pipeline.</p>
      </div>
      <LeadForm />
    </div>
  );
}
