import { createAdminClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

// Service-role callers must resolve membership from persisted active records.
// A company supervisor may see that company's crews without joining each crew;
// other workers remain limited to their own crew/direct assignments.
export async function loadAssignmentScope(sb: AdminClient, userId: string, role: string) {
  const [crewResult, companyResult] = await Promise.all([
    sb.from("crew_members")
      .select("crew_id, crews!inner(active,subcontractor_company_id)")
      .eq("employee_id", userId).eq("crews.active", true),
    sb.from("subcontractor_memberships")
      .select("subcontractor_company_id, role, subcontractor_companies!inner(status)")
      .eq("user_id", userId).eq("active", true)
      .eq("subcontractor_companies.status", "active"),
  ]);
  if (crewResult.error || companyResult.error) throw new Error("Could not verify current assignments.");

  const companyRows = role === "subcontractor" ? companyResult.data ?? [] : [];
  const companyIds = [...new Set(companyRows.map(row => row.subcontractor_company_id))];
  const companySet = new Set(companyIds);
  const supervisorCompanyIds = [...new Set(companyRows
    .filter(row => row.role === "owner" || row.role === "manager")
    .map(row => row.subcontractor_company_id))];
  const crewIds = [...new Set((crewResult.data ?? [])
    .filter(row => {
      const crew = row.crews as unknown as { subcontractor_company_id: string | null };
      return crew.subcontractor_company_id
        ? role === "subcontractor" && companySet.has(crew.subcontractor_company_id)
        : role !== "subcontractor";
    })
    .map(row => row.crew_id))];

  let supervisorCrewIds: string[] = [];
  if (supervisorCompanyIds.length) {
    const { data, error } = await sb.from("crews")
      .select("id").eq("active", true)
      .in("subcontractor_company_id", supervisorCompanyIds);
    if (error) throw new Error("Could not verify company crews.");
    supervisorCrewIds = (data ?? []).map(crew => crew.id);
  }
  return {
    crewIds,
    companyIds,
    supervisorCompanyIds,
    supervisorCrewIds,
    visibleCrewIds: [...new Set([...crewIds, ...supervisorCrewIds])],
  };
}
