import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { Plus, Package, AlertTriangle } from "lucide-react";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; low?: string }>;
}) {
  const { category, low } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("id, name, category, unit_of_measure, current_quantity, reorder_point, billable_price, barcode, sku, active, suppliers(company_name)")
    .eq("active", true)
    .order("name");

  if (category) query = query.eq("category", category);
  if (low === "1") query = query.filter("current_quantity", "lte", "reorder_point");

  const { data: products } = await query.limit(100);

  const { data: categories } = await supabase
    .from("products")
    .select("category")
    .eq("active", true)
    .order("category");

  const uniqueCategories = [...new Set(categories?.map(c => c.category) ?? [])];
  const lowStockCount = products?.filter(p => p.current_quantity <= p.reorder_point).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Inventory</h1>
          {lowStockCount > 0 && (
            <p className="text-sm text-yellow-600 flex items-center gap-1 mt-1">
              <AlertTriangle size={14} /> {lowStockCount} item{lowStockCount !== 1 ? "s" : ""} low on stock
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/purchase-orders/new" className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            New PO
          </Link>
          <Link href="/inventory/new" className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors">
            <Plus size={16} /> Add Item
          </Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link href="/inventory" className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${!category && !low ? "bg-charcoal text-white" : "bg-white border border-gray-200 text-muted hover:bg-gray-50"}`}>All</Link>
        <Link href="/inventory?low=1" className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${low === "1" ? "bg-yellow-600 text-white" : "bg-white border border-gray-200 text-muted hover:bg-gray-50"}`}>
          ⚠ Low Stock
        </Link>
        {uniqueCategories.map(cat => (
          <Link key={cat} href={`/inventory?category=${encodeURIComponent(cat)}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${category === cat ? "bg-charcoal text-white" : "bg-white border border-gray-200 text-muted hover:bg-gray-50"}`}>
            {cat}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {(!products || products.length === 0) ? (
          <div className="py-16 text-center">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No inventory items found</p>
            <Link href="/inventory/new" className="mt-4 inline-block text-sm text-redline hover:underline">Add inventory item</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Item</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">Category</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">On Hand</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">Reorder At</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase hidden lg:table-cell">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map(product => {
                const isLow = product.current_quantity <= product.reorder_point;
                return (
                  <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${isLow ? "bg-yellow-50/50" : ""}`}>
                    <td className="px-5 py-3">
                      <Link href={`/inventory/${product.id}`} className="font-medium text-charcoal hover:text-redline flex items-center gap-2">
                        {isLow && <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0" />}
                        {product.name}
                      </Link>
                      {product.sku && <p className="text-xs text-muted">SKU: {product.sku}</p>}
                    </td>
                    <td className="px-5 py-3 text-muted hidden md:table-cell capitalize">{product.category}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={isLow ? "text-yellow-600 font-semibold" : "text-charcoal"}>
                        {product.current_quantity} {product.unit_of_measure}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-muted hidden sm:table-cell">{product.reorder_point}</td>
                    <td className="px-5 py-3 text-right text-muted hidden lg:table-cell">{formatCurrency(product.billable_price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
