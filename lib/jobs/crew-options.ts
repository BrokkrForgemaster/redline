import type { ApiSupabaseClient } from "@/lib/api/auth";

export async function loadJobCrewOptions(supabase: ApiSupabaseClient) {
  const [crewsResult, supervisorsResult] = await Promise.all([
    supabase.from("crews")
      .select("id,name,subcontractor_company_id,subcontractor_companies(name,status)")
      .eq("active", true).order("name"),
    supabase.from("subcontractor_memberships")
      .select("subcontractor_company_id,profiles!inner(status,role)")
      .eq("active", true).in("role", ["owner", "manager"])
      .eq("profiles.status", "active").eq("profiles.role", "subcontractor"),
  ]);
  if (crewsResult.error || supervisorsResult.error) {
    throw new Error("Crew assignment options could not be loaded. Please retry.");
  }
  const supervisedCompanies = new Set((supervisorsResult.data ?? [])
    .map(row => row.subcontractor_company_id));
  return (crewsResult.data ?? []).flatMap(crew => {
    const company = crew.subcontractor_companies as unknown as
      { name: string; status: string } | null;
    if (crew.subcontractor_company_id && company?.status !== "active") return [];
    return [{
      id: crew.id,
      name: crew.name,
      companyName: company?.name ?? null,
      hasSupervisor: crew.subcontractor_company_id
        ? supervisedCompanies.has(crew.subcontractor_company_id) : true,
    }];
  });
}
