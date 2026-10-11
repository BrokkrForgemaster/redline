import { requireApiUser } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/errors";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  const url = new URL(request.url);
  const workOrderId = url.searchParams.get("work_order_id");

  let query = sb
    .from("service_runs")
    .select(`
      id,
      work_order_id,
      status,
      started_at,
      finished_at,
      submitted_at,
      work_orders(
        id,
        work_order_number,
        title,
        scheduled_start,
        instructions,
        customers(id, first_name, last_name, business_name),
        properties(
          id, address_line1, city, state, zip,
          geofence_radius_meters,
          access_instructions,
          service_instructions,
          safety_instructions
        )
      )
    `)
    .eq("primary_worker_id", auth.user.id)
    .in("status", ["in_progress", "paused"])
    .is("submitted_at", null)
    .order("started_at", { ascending: false })
    .limit(10);

  if (workOrderId) {
    query = query.eq("work_order_id", workOrderId);
  }

  const { data: runs } = await query;

  return apiOk({ service_runs: runs ?? [] });
}
