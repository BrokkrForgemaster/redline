import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/api/auth";

export const metadata = { title: "Work Orders" };

const openStatuses = ["scheduled", "assigned", "ready", "in_progress", "paused", "submitted", "needs_review"];

export default async function WorkOrdersPage({ searchParams }: {
  searchParams: Promise<{ page?: string }>;
}) {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) notFound();
  const requested = Number.parseInt((await searchParams).page ?? "1", 10);
  const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 400) : 1;
  const pageSize = 25;
  const { data, count, error } = await access.supabase.from("work_orders")
    .select("id, work_order_number, title, status, scheduled_start, customers(first_name, last_name, business_name)", { count: "exact" })
    .in("status", openStatuses)
    .order("scheduled_start", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);

  return <div className="mx-auto max-w-5xl space-y-5 pb-8">
    <div><h1 className="text-2xl font-bold">Open Work Orders</h1><p className="text-sm text-muted">{error ? "Unavailable" : `${count ?? 0} open work orders`}</p></div>
    {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">Work orders could not be loaded. Refresh to retry.</p> :
      data?.length ? <div className="divide-y rounded-xl border bg-white">
        {data.map(order => {
          const customer = order.customers as unknown as { first_name: string; last_name: string; business_name: string | null } | null;
          return <Link key={order.id} href={`/my-jobs/run/${order.id}`} className="block p-4 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-redline">
          <p className="text-xs text-muted">#{order.work_order_number} · {order.status.replaceAll("_", " ")}</p>
          <p className="font-semibold">{order.title}</p>
          <p className="text-sm text-muted">{customer?.business_name || `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim()}</p>
        </Link>})}
      </div> : <p className="rounded-xl border bg-white p-8 text-muted">No open work orders.</p>}
    <div className="flex justify-between text-sm">
      {page > 1 ? <Link href={`/work-orders?page=${page - 1}`} className="text-redline underline">Previous</Link> : <span />}
      {page * pageSize < (count ?? 0) && <Link href={`/work-orders?page=${page + 1}`} className="text-redline underline">Next</Link>}
    </div>
  </div>;
}
