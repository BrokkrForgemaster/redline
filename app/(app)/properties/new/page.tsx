import { createClient } from "@/lib/supabase/server";
import PropertyForm from "./PropertyForm";

export const metadata = { title: "New Property" };

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, business_name")
    .is("deleted_at", null)
    .eq("status", "active")
    .order("last_name");

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">New Property</h1>
        <p className="text-sm text-muted mt-1">
          Add a new service property to your database.
        </p>
      </div>
      <PropertyForm
        customers={customers ?? []}
        defaultCustomerId={customerId}
      />
    </div>
  );
}
