import { requireApiUser } from "@/lib/api/auth";
import { requireWorkOrderAccess } from "@/lib/api/service-access";
import { createAdminClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/errors";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const access = await requireWorkOrderAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;
  if (!["scheduled", "assigned", "ready", "in_progress", "paused"].includes(access.workOrder.status)) {
    return apiError(409, "INVALID_STATE_TRANSITION", "This work order cannot prepare a visit.");
  }

  const sb = createAdminClient();
  const open = () => sb.from("service_runs")
    .select("id, status, started_at, finished_at, submitted_at")
    .eq("work_order_id", id).in("status", ["ready", "in_progress", "paused"])
    .is("submitted_at", null).order("created_at", { ascending: false }).limit(1);
  const existing = await open();
  if (existing.error) return apiError(500, "INTERNAL_ERROR", "Could not load visit.");
  if (existing.data?.length) return apiOk({ service_run: existing.data[0] });

  const { data: workOrder } = await sb.from("work_orders").select("template_version_id")
    .eq("id", id).single();
  const { data: created, error } = await sb.from("service_runs")
    .insert({ work_order_id: id, template_version_id: workOrder?.template_version_id ?? null, status: "ready" })
    .select("id, status, started_at, finished_at, submitted_at").single();
  if (!error && created) return apiOk({ service_run: created }, 201);

  // Migration 022's unique index resolves simultaneous prepare requests.
  const raced = await open();
  if (raced.data?.length) return apiOk({ service_run: raced.data[0] });
  return apiError(500, "INTERNAL_ERROR", "Could not prepare visit.");
}
