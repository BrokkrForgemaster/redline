import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { requireServiceRunAccess } from "@/lib/api/service-access";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireServiceRunAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  const { data: assets, error } = await sb
    .from("media_assets")
    .select("id, evidence_type, media_category, status, byte_size, created_at")
    .eq("service_run_id", id)
    .in("status", ["attached", "finalized"])
    .order("created_at", { ascending: true });

  if (error) {
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch media assets.");
  }

  const list = (assets ?? []) as Array<{ evidence_type: string | null }>;
  const before = list.filter((a) => a.evidence_type === "before").length;
  const after = list.filter((a) => a.evidence_type === "after").length;

  return apiOk({
    counts: { before, after },
    assets: assets ?? [],
  });
}
