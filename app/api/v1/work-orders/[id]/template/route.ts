import { requireApiUser } from "@/lib/api/auth";
import { requireWorkOrderAccess } from "@/lib/api/service-access";
import { apiError, apiOk } from "@/lib/api/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const access = await requireWorkOrderAccess(auth.supabase, auth.user.id, id);
  if (!access.ok) return access.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  // Find the template version for this work order
  const { data: wo } = await sb
    .from("work_orders")
    .select("template_version_id, service_type_id, service_types(code, name)")
    .eq("id", id)
    .single();

  let templateVersionId: string | null = wo?.template_version_id ?? null;

  // Fall back to the active version for the work order's service type
  if (!templateVersionId && wo?.service_type_id) {
    const { data: version } = await sb
      .from("service_template_versions")
      .select("id, service_template_lineages!inner(service_type_id)")
      .eq("service_template_lineages.service_type_id", wo.service_type_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    templateVersionId = version?.id ?? null;
  }

  if (!templateVersionId) {
    return apiOk({
      template_version_id: null,
      service_type: wo?.service_types ?? null,
      sections: [],
    });
  }

  const { data: sections, error } = await sb
    .from("checklist_sections")
    .select(`
      id, title, description, sort_order,
      checklist_items(id, label, response_type, required, options, sort_order)
    `)
    .eq("template_version_id", templateVersionId)
    .order("sort_order");

  if (error) return apiError(500, "INTERNAL_ERROR", error.message);

  // Sort items within each section
  const sorted = (sections ?? []).map((section: {
    id: string; title: string; description: string | null; sort_order: number;
    checklist_items: { id: string; label: string; response_type: string; required: boolean; options: unknown[]; sort_order: number }[];
  }) => ({
    ...section,
    checklist_items: [...(section.checklist_items ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  }));

  return apiOk({
    template_version_id: templateVersionId,
    service_type: wo?.service_types ?? null,
    sections: sorted,
  });
}
