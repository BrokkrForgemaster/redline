import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import StatusBadge from "@/components/ui/StatusBadge";
import { Edit, Package, AlertTriangle } from "lucide-react";
import AdjustStockForm from "./AdjustStockForm";
import type { Product } from "@/types/database";

type ProductWithSupplier = Product & {
  suppliers: { company_name: string } | null;
};

interface Transaction {
  id: string;
  transaction_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: number | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("name").eq("id", id).single();
  const product = data as { name?: string } | null;
  return { title: product?.name ?? "Inventory Item" };
}

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rawProduct } = await supabase
    .from("products")
    .select("*, suppliers(company_name)")
    .eq("id", id)
    .single();

  if (!rawProduct) notFound();

  const product = rawProduct as unknown as ProductWithSupplier;

  const { data: rawTransactions } = await supabase
    .from("inventory_transactions")
    .select("id, transaction_type, quantity_change, quantity_before, quantity_after, unit_cost, reference_number, notes, created_at, profiles!created_by(first_name, last_name)")
    .eq("product_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const transactions = (rawTransactions ?? []) as unknown as Transaction[];

  const isLow = product.current_quantity <= product.reorder_point;
  const isNearLow = !isLow && product.current_quantity <= product.reorder_point * 1.5;

  const stockColor = isLow
    ? "text-red-600 font-bold"
    : isNearLow
    ? "text-yellow-600 font-semibold"
    : "text-lawn font-semibold";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/inventory" className="text-sm text-muted hover:text-charcoal">
          Inventory
        </Link>
        <span className="text-muted">/</span>
        <span className="text-charcoal font-medium">{product.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-charcoal">{product.name}</h1>
            <StatusBadge
              label={product.active ? "Active" : "Inactive"}
              variant={product.active ? "green" : "gray"}
            />
          </div>
          {product.sku && <p className="text-sm text-muted mt-1">SKU: {product.sku}</p>}
          {isLow && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 mt-1">
              <AlertTriangle size={14} /> Low stock — below reorder point
            </p>
          )}
        </div>
        <Link
          href={`/inventory/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-charcoal"
        >
          <Edit size={14} /> Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-charcoal mb-4 flex items-center gap-2">
              <Package size={16} className="text-muted" /> Product Details
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted">Category</dt>
                <dd className="text-charcoal font-medium capitalize mt-0.5">
                  {product.category?.replace(/_/g, " ") ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Brand</dt>
                <dd className="text-charcoal font-medium mt-0.5">{product.brand ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Unit of Measure</dt>
                <dd className="text-charcoal font-medium mt-0.5">{product.unit_of_measure ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Supplier</dt>
                <dd className="text-charcoal font-medium mt-0.5">
                  {product.suppliers?.company_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Purchase Cost</dt>
                <dd className="text-charcoal font-medium mt-0.5">
                  {product.purchase_cost != null ? formatCurrency(product.purchase_cost) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Billable Price</dt>
                <dd className="text-charcoal font-medium mt-0.5">
                  {product.billable_price != null ? formatCurrency(product.billable_price) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Storage Location</dt>
                <dd className="text-charcoal font-medium mt-0.5">{product.location ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Bin</dt>
                <dd className="text-charcoal font-medium mt-0.5">{product.bin ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Barcode</dt>
                <dd className="text-charcoal font-medium mt-0.5">{product.barcode ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Manufacturer Part #</dt>
                <dd className="text-charcoal font-medium mt-0.5">{product.manufacturer_part ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Taxable</dt>
                <dd className="text-charcoal font-medium mt-0.5">{product.taxable ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted">Added</dt>
                <dd className="text-charcoal font-medium mt-0.5">{formatDate(product.created_at)}</dd>
              </div>
            </dl>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-charcoal">Transaction History</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted">No transactions recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Date</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Type</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">Change</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">Before</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">After</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">Reference</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden lg:table-cell">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map((tx) => {
                      const isPositive = (tx.quantity_change ?? 0) > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-muted whitespace-nowrap">
                            {formatDate(tx.created_at, "MMM d, yyyy")}
                          </td>
                          <td className="px-5 py-3 capitalize text-charcoal">
                            {tx.transaction_type?.replace(/_/g, " ") ?? "—"}
                          </td>
                          <td className={`px-5 py-3 text-right font-semibold ${isPositive ? "text-lawn" : "text-red-600"}`}>
                            {isPositive ? "+" : ""}{tx.quantity_change}
                          </td>
                          <td className="px-5 py-3 text-right text-muted hidden sm:table-cell">
                            {tx.quantity_before}
                          </td>
                          <td className="px-5 py-3 text-right text-muted hidden sm:table-cell">
                            {tx.quantity_after}
                          </td>
                          <td className="px-5 py-3 text-muted hidden md:table-cell">
                            {tx.reference_number ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-muted hidden lg:table-cell">
                            {tx.profiles
                              ? `${tx.profiles.first_name} ${tx.profiles.last_name}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Stock */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-charcoal mb-4">Stock Levels</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">On Hand</span>
                <span className={stockColor}>
                  {product.current_quantity} {product.unit_of_measure}
                </span>
              </div>
              {product.reserved_quantity > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Reserved</span>
                  <span className="text-charcoal">{product.reserved_quantity}</span>
                </div>
              )}
              <div className="h-px bg-gray-100" />
              <div className="flex items-center justify-between">
                <span className="text-muted">Reorder Point</span>
                <span className="text-charcoal">{product.reorder_point}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Reorder Qty</span>
                <span className="text-charcoal">{product.reorder_quantity}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Min Stock</span>
                <span className="text-charcoal">{product.min_stock}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Max Stock</span>
                <span className="text-charcoal">{product.max_stock}</span>
              </div>
            </div>
          </div>

          <AdjustStockForm
            productId={id}
            currentQuantity={product.current_quantity}
            unitOfMeasure={product.unit_of_measure}
          />
        </div>
      </div>
    </div>
  );
}
