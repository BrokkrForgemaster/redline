import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { requireWorkOrderAccess } from "@/lib/api/service-access";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const workOrderId = url.searchParams.get("work_order_id");
  if (!workOrderId || !/^[0-9a-f-]{36}$/i.test(workOrderId)) {
    return apiError(400, "VALIDATION_ERROR", "A work order ID is required.");
  }
  const access = await requireWorkOrderAccess(auth.supabase, auth.user.id, workOrderId);
  if (!access.ok) return access.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;

  const { data: runs, error } = await sb
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
        customers(business_name),
        properties(
          id, address_line1, city, state, zip,
          geofence_radius_meters,
          access_instructions,
          service_instructions,
          safety_instructions
        )
      )
    `)
    .eq("work_order_id", workOrderId)
    .in("status", ["ready", "in_progress", "paused", "completed"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return apiError(500, "INTERNAL_ERROR", "Could not load active visits.");

  return apiOk({ service_runs: runs ?? [] });
}
