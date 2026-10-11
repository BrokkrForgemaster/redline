import { requireApiUser } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/errors";
import { requireWorkOrderAccess } from "@/lib/api/service-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireWorkOrderAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;

  return apiOk({ work_order: access.workOrder });
}
