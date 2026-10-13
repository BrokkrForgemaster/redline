import { requireStaffUser } from "@/lib/api/auth";
import NewCrewForm from "./NewCrewForm";

export const metadata = { title: "New Crew" };

export default async function NewCrewPage() {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) return <p>Active Admin account with verified MFA required.</p>;
  const supabase = access.supabase;

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .eq("status", "active")
    .eq("role", "mowing_crew_lead")
    .order("last_name");

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">New Crew</h1>
        <p className="text-sm text-muted mt-1">Create a crew and assign a leader. Add members after saving.</p>
      </div>
      <NewCrewForm employees={employees ?? []} />
    </div>
  );
}
