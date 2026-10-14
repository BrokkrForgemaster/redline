import { requireStaffUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";

export async function GET(request: Request) {
  const auth = await requireStaffUser("reviewer");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "submitted";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const validStatuses = ["submitted", "needs_review", "completed", "rejected", "in_progress", "paused"];
  if (!validStatuses.includes(status)) {
    return apiError(400, "VALIDATION_ERROR", `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  const { data: runs, error, count } = await sb
    .from("service_runs")
    .select(
      `id, status, started_at, finished_at, submitted_at, reviewed_at, version_number, created_at,
       work_orders(id, work_order_number, title, scheduled_start,
         customers(first_name, last_name, business_name),
         properties(address_line1, city, state)
       ),
       profiles!service_runs_primary_worker_id_fkey(id, first_name, last_name)`,
      { count: "exact" }
    )
    .eq("status", status)
    .order("submitted_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch service runs.");
  }

  return apiOk({ service_runs: runs ?? [], total: count ?? 0, limit, offset });
}
