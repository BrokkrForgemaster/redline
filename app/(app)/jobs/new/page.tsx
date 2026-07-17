import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import JobForm from "./JobForm";

export const metadata: Metadata = { title: "New Job" };

export default async function NewJobPage() {
  const supabase = await createClient();

  const [{ data: customers }, { data: crews }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, first_name, last_name, business_name, account_type")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("last_name"),
    supabase
      .from("crews")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/jobs" className="text-sm text-muted hover:text-charcoal">Jobs</Link>
          <ChevronRight size={14} className="text-muted" />
          <span className="text-sm text-charcoal font-medium">New Job</span>
        </div>
        <h1 className="text-2xl font-bold text-charcoal">New Job</h1>
        <p className="text-sm text-muted mt-1">Create a new job and assign it to a crew.</p>
      </div>
      <JobForm customers={customers ?? []} crews={crews ?? []} />
    </div>
  );
}
