import { requireStaffUser } from "@/lib/api/auth";
import SubcontractorManager from "./SubcontractorManager";

export const metadata = { title: "Subcontractors" };

export default async function SubcontractorsPage() {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) return <p>Active Admin account with verified MFA required.</p>;
  const [companies, memberships, people] = await Promise.all([
    access.supabase.from("subcontractor_companies")
      .select("id,name,status").order("name"),
    access.supabase.from("subcontractor_memberships")
      .select("subcontractor_company_id,user_id,role,active")
      .eq("active", true),
    access.supabase.from("profiles")
      .select("id,first_name,last_name,status,role")
      .eq("role", "subcontractor").eq("status", "active").order("last_name"),
  ]);
  if (companies.error || memberships.error || people.error) {
    return <p>Subcontractors could not be loaded. Check migration 043 and refresh.</p>;
  }
  return <SubcontractorManager companies={companies.data ?? []}
    memberships={memberships.data ?? []} people={people.data ?? []} />;
}
