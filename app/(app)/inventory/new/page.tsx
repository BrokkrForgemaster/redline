import { createClient } from "@/lib/supabase/server";
import ProductForm from "./ProductForm";

export const metadata = { title: "New Inventory Item" };

export default async function NewInventoryPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, company_name")
    .eq("active", true)
    .order("company_name");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <nav className="flex items-center gap-2 text-sm mb-4">
          <a href="/inventory" className="text-sm text-muted hover:text-charcoal">Inventory</a>
          <span className="text-muted">/</span>
          <span className="text-charcoal font-medium">New Item</span>
        </nav>
        <h1 className="text-2xl font-bold text-charcoal">Add Inventory Item</h1>
      </div>
      <ProductForm suppliers={suppliers ?? []} />
    </div>
  );
}
