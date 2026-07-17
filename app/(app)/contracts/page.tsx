import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils/format";

export const metadata = { title: "Contracts" };

type ContractStatus =
  | "active"
  | "approved"
  | "draft"
  | "sent"
  | "expired"
  | "suspended"
  | "cancelled"
  | "completed";

function contractStatusBadge(status: string): {
  label: string;
  variant: "green" | "blue" | "gray" | "orange" | "yellow";
} {
  const map: Record<string, { label: string; variant: "green" | "blue" | "gray" | "orange" | "yellow" }> = {
    active: { label: "Active", variant: "green" },
    approved: { label: "Approved", variant: "green" },
    draft: { label: "Draft", variant: "gray" },
    sent: { label: "Sent", variant: "blue" },
    expired: { label: "Expired", variant: "orange" },
    suspended: { label: "Suspended", variant: "yellow" },
    cancelled: { label: "Cancelled", variant: "gray" },
    completed: { label: "Completed", variant: "gray" },
  };
  return map[status] ?? { label: status, variant: "gray" };
}

interface SearchParams {
  status?: string;
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  type ContractRow = {
    id: string; contract_number: string; customer_id: string; contract_type: string | null;
    status: string; title: string; start_date: string; end_date: string | null;
    total: number; created_at: string;
    customers: { first_name: string; last_name: string } | null;
  };

  let query = supabase
    .from("contracts")
    .select(
      "id, contract_number, customer_id, contract_type, status, title, start_date, end_date, total, created_at, customers(first_name, last_name)"
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status as ContractStatus);
  }

  const { data: contracts } = await query as { data: ContractRow[] | null };

  const tabs = ["all", "active", "draft", "expired", "cancelled"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Contracts</h1>
          <p className="text-sm text-muted">{contracts?.length ?? 0} total</p>
        </div>
        <Link
          href="/contracts/new"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Plus size={16} />
          New Contract
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={tab === "all" ? "/contracts" : `/contracts?status=${tab}`}
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
        {!contracts || contracts.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No contracts found</p>
            <p className="text-sm text-muted mt-1">
              {status && status !== "all"
                ? `No ${status} contracts`
                : "Create your first contract to get started"}
            </p>
            <Link
              href="/contracts/new"
              className="mt-4 inline-block text-sm text-redline hover:underline"
            >
              New Contract
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Contract #
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                    Customer
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Start Date
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    End Date
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contracts.map((contract) => {
                  const customer = contract.customers as {
                    first_name: string;
                    last_name: string;
                  } | null;
                  const badge = contractStatusBadge(contract.status);
                  return (
                    <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="block"
                        >
                          <p className="font-medium text-charcoal hover:text-redline transition-colors">
                            {contract.contract_number}
                          </p>
                          {contract.title && (
                            <p className="text-xs text-muted">{contract.title}</p>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted hidden md:table-cell">
                        {customer
                          ? `${customer.first_name} ${customer.last_name}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-muted capitalize hidden sm:table-cell">
                        {contract.contract_type?.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge label={badge.label} variant={badge.variant} />
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {formatDate(contract.start_date)}
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {formatDate(contract.end_date)}
                      </td>
                      <td className="px-5 py-3 font-medium text-charcoal hidden sm:table-cell">
                        {contract.total != null
                          ? formatCurrency(contract.total)
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
  );
}
