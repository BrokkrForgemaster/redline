import { requireStaffUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/server";

// Compatibility endpoint for old owner screens. Routine finish is committed by
// apply_visit_start_finish; this path must never promote submitted evidence.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffUser("reviewer");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data: run, error } = await createAdminClient().from("service_runs")
    .select("id, status").eq("id", id).single();
  if (error || !run) return apiError(404, "NOT_FOUND", "Service visit was not found.");
  if (run.status !== "completed") {
    return apiError(409, "INVALID_STATE_TRANSITION", "Complete the visit through the verified finish workflow.");
  }
  return apiOk({ service_run: run, report_url: null });
}
