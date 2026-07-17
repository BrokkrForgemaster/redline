import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils/format";

export const metadata = { title: "Purchase Orders" };

function poStatusBadge(status: string): {
  label: string;
  variant: "gray" | "blue" | "green" | "yellow";
} {
  const map: Record<string, { label: string; variant: "gray" | "blue" | "green" | "yellow" }> = {
    draft: { label: "Draft", variant: "gray" },
    submitted: { label: "Submitted", variant: "blue" },
    confirmed: { label: "Confirmed", variant: "green" },
    partially_received: { label: "Partial", variant: "yellow" },
    received: { label: "Received", variant: "green" },
    cancelled: { label: "Cancelled", variant: "gray" },
    closed: { label: "Closed", variant: "gray" },
  };
  return map[status] ?? { label: status.replace(/_/g, " "), variant: "gray" };
}

interface SearchParams {
  status?: string;
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("purchase_orders")
    .select(
      "id, po_number, status, order_date, expected_delivery, total, suppliers(company_name)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: orders } = await query;

  const tabs = ["all", "draft", "submitted", "confirmed", "received"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Purchase Orders</h1>
          <p className="text-sm text-muted">{orders?.length ?? 0} orders</p>
        </div>
        <Link
          href="/purchase-orders/new"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Plus size={16} />
          New PO
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={tab === "all" ? "/purchase-orders" : `/purchase-orders?status=${tab}`}
            className={
              (status ?? "all") === tab
                ? "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors bg-charcoal text-white"
                : "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors bg-white border border-gray-200 text-muted hover:bg-gray-50"
            }
          >
            {tab}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!orders || orders.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No purchase orders found</p>
            <p className="text-sm text-muted mt-1">
              {status && status !== "all"
                ? `No ${status} purchase orders`
                : "Create your first purchase order to get started"}
            </p>
            <Link
              href="/purchase-orders/new"
              className="mt-4 inline-block text-sm text-redline hover:underline"
            >
              New PO
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    PO #
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                    Supplier
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Order Date
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Expected Delivery
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => {
                  const supplier = order.suppliers as unknown as { company_name: string } | null;
                  const badge = poStatusBadge(order.status);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/purchase-orders/${order.id}`}
                          className="font-medium text-charcoal hover:text-redline"
                        >
                          {order.po_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted hidden md:table-cell">
                        {supplier?.company_name ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge label={badge.label} variant={badge.variant} />
                      </td>
                      <td className="px-5 py-3 text-muted hidden sm:table-cell">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {formatDate(order.expected_delivery)}
                      </td>
                      <td className="px-5 py-3 font-medium text-charcoal hidden sm:table-cell">
                        {order.total != null ? formatCurrency(order.total) : "—"}
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
  );
}
