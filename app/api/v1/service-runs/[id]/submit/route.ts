import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { requireServiceRunAccess } from "@/lib/api/service-access";
import { apiError, apiOk } from "@/lib/api/errors";

// Compatibility for older field queues. Routine finish is the final visit
// transition; it does not submit the project or request office approval.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "VALIDATION_ERROR", "Invalid visit ID.");
  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;
  const visit = access.serviceRun;
  if (visit.status !== "completed" || !visit.finished_at) {
    return apiError(409, "INVALID_STATE_TRANSITION", "Finish and confirm this visit before clearing the older submit intent.");
  }
  return apiOk({ service_run: { id: visit.id, status: "completed", finished_at: visit.finished_at } });
}
