import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import EditProductForm from "./EditProductForm";
import type { Product, Supplier } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("name").eq("id", id).single();
  const product = data as { name?: string } | null;
  return { title: product?.name ? `Edit — ${product.name}` : "Edit Inventory Item" };
}

export default async function EditInventoryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rawProduct } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (!rawProduct) notFound();

  // Cast needed due to Supabase type inference limitations with select("*")
  const product = rawProduct as unknown as Product;

  const { data: rawSuppliers } = await supabase
    .from("suppliers")
    .select("id, company_name")
    .eq("active", true)
    .order("company_name");

  const suppliers = (rawSuppliers ?? []) as unknown as Pick<Supplier, "id" | "company_name">[];

  return (
    <div className="space-y-6 max-w-3xl">
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/inventory" className="text-sm text-muted hover:text-charcoal">
          Inventory
        </Link>
        <span className="text-muted">/</span>
        <Link href={`/inventory/${id}`} className="text-sm text-muted hover:text-charcoal">
          {product.name}
        </Link>
        <span className="text-muted">/</span>
        <span className="text-charcoal font-medium">Edit</span>
      </nav>

      <h1 className="text-2xl font-bold text-charcoal">Edit: {product.name}</h1>

      <EditProductForm
        productId={id}
        product={product}
        suppliers={suppliers}
      />
    </div>
  );
}
