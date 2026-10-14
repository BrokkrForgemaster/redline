import { requireStaffUser } from "@/lib/api/auth";
import { apiError } from "@/lib/api/errors";

// A rejected visit requires an audited amendment command. The old read/update/
// event sequence was race-prone and could leave an unaudited state change.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffUser("reviewer");
  if (!auth.ok) return auth.response;
  await params;
  return apiError(409, "INVALID_STATE_TRANSITION", "Visit rejection requires an audited exception workflow.");
}
