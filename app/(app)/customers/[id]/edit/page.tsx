import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CustomerForm from "@/components/forms/CustomerForm";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Database } from "@/types/database";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("first_name, last_name")
    .eq("id", id)
    .single() as { data: Pick<CustomerRow, "first_name" | "last_name"> | null; error: unknown };
  return { title: data ? `Edit ${data.first_name} ${data.last_name}` : "Edit Customer" };
}

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single() as { data: CustomerRow | null; error: unknown };

  if (!customer) notFound();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/customers" className="text-sm text-muted hover:text-charcoal">
          Customers
        </Link>
        <ChevronRight size={14} className="text-muted" />
        <Link href={`/customers/${id}`} className="text-sm text-muted hover:text-charcoal">
          {customer.first_name} {customer.last_name}
        </Link>
        <ChevronRight size={14} className="text-muted" />
        <span className="text-sm text-charcoal font-medium">Edit</span>
      </div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Edit Customer</h1>
      <CustomerForm customer={customer} />
    </div>
  );
}
