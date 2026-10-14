import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOperationalRole } from "@/lib/auth/roles";

export const metadata = { title: "Search Work" };

type SearchResult = {
  id: string;
  work_order_number: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  customer_name: string;
  property_address: string;
  total_count: number;
};

const statuses = ["all", "open", "active", "scheduled", "assigned", "ready", "in_progress", "paused", "submitted", "needs_review", "completed"];
const sorts = ["scheduled_asc", "scheduled_desc", "updated_desc"];

export default async function SearchPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string }>;
}) {
  const { q = "", status = "all", sort = "scheduled_asc", page = "1" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const safeStatus = statuses.includes(status) ? status : "all";
  const safeSort = sorts.includes(sort) ? sort : "scheduled_asc";
  const safePage = Math.min(Math.max(Number.parseInt(page, 10) || 1, 1), 400);
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await client.from("profiles")
    .select("role, status").eq("id", user.id).single();
  if (profile?.status !== "active" || !isOperationalRole(profile.role)) redirect("/dashboard");

  let results: SearchResult[] = [];
  let error: string | null = null;
  {
    // Migration 033 provides this scoped RPC; generated schema types lag SQL.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (client as any).rpc("search_assigned_work_orders", {
      p_query: query,
      p_status: safeStatus === "all" ? null : safeStatus,
      p_sort: safeSort,
      p_page_size: 25,
      p_offset: (safePage - 1) * 25,
    });
    if (response.error) error = "Search is unavailable. Try again after reconnecting.";
    else results = (response.data ?? []) as SearchResult[];
  }

  const total = results[0]?.total_count ?? 0;
  const makeHref = (nextPage: number) => `/search?${new URLSearchParams({
    q: query, status: safeStatus, sort: safeSort, page: String(nextPage),
  })}`;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Search Work</h1>
        <p className="mt-1 text-sm text-muted">Results follow your current assignments and company membership. Staff search includes job number, title, business name and address.</p>
      </div>
      <form action="/search" className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <input name="q" type="search" defaultValue={query} maxLength={100} placeholder={profile.role === "owner" ? "Job, customer, business or address" : "Job, business or address"}
          className="min-w-0 rounded-lg border px-3 py-2" aria-label="Search work" />
        <select name="status" defaultValue={safeStatus} aria-label="Status" className="rounded-lg border px-3 py-2">
          {statuses.map(value => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
        </select>
        <select name="sort" defaultValue={safeSort} aria-label="Sort" className="rounded-lg border px-3 py-2">
          <option value="scheduled_asc">Schedule: earliest</option>
          <option value="scheduled_desc">Schedule: latest</option>
          <option value="updated_desc">Recently updated</option>
        </select>
        <button type="submit" className="rounded-lg bg-redline px-4 py-2 font-semibold text-white">Search</button>
      </form>
      {query && <Link href="/search" className="text-sm font-medium text-redline underline">Reset filters</Link>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {!error && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{total} matching work orders</p>
          {results.length === 0 && <p className="rounded-xl border bg-white p-8 text-center text-muted">No matching assigned work.</p>}
          {results.map(result => (
            <Link key={result.id} href={`/my-jobs/run/${result.id}`} className="block rounded-xl border bg-white p-4 hover:border-redline">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">Work order #{result.work_order_number}</p>
                  <h2 className="font-semibold text-charcoal">{result.title}</h2>
                  <p className="text-sm text-muted">{result.customer_name} · {result.property_address}</p>
                  {result.scheduled_start && <p className="mt-1 text-xs text-muted">Scheduled {new Date(result.scheduled_start).toLocaleString()}</p>}
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize">{result.status.replace(/_/g, " ")}</span>
              </div>
            </Link>
          ))}
          <div className="flex justify-between text-sm">
            {safePage > 1 ? <Link href={makeHref(safePage - 1)} className="text-redline underline">Previous</Link> : <span />}
            {safePage * 25 < total && <Link href={makeHref(safePage + 1)} className="text-redline underline">Next</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
