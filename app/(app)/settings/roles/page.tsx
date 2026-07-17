import { createClient } from "@/lib/supabase/server";
import RoleSelect from "./RoleSelect";
import { Users } from "lucide-react";
import type { Profile } from "@/types/database";

export const metadata = { title: "Roles & Permissions" };

const ROLE_LABELS: Record<string, string> = {
  administrator: "Administrator",
  operations_manager: "Operations Manager",
  office_manager: "Office Manager",
  estimator: "Estimator",
  crew_leader: "Crew Leader",
  crew_member: "Crew Member",
  snow_operations_manager: "Snow Ops Manager",
  inventory_manager: "Inventory Manager",
  bookkeeper: "Bookkeeper",
  read_only: "Read Only",
};

export default async function RolesPage() {
  const supabase = await createClient();
  const { data: rawProfiles } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, role, status")
    .neq("role", "customer")
    .order("last_name");

  const profiles = (rawProfiles ?? []) as unknown as Pick<Profile, "id" | "email" | "first_name" | "last_name" | "role" | "status">[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Roles & Permissions</h1>
        <p className="text-sm text-muted mt-1">
          Manage team member roles to control what each person can access.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-charcoal mb-3 text-sm">Role Descriptions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted">
          <div><span className="font-medium text-charcoal">Administrator</span> — Full access to all features</div>
          <div><span className="font-medium text-charcoal">Operations Manager</span> — Jobs, crews, scheduling</div>
          <div><span className="font-medium text-charcoal">Office Manager</span> — Customers, estimates, invoices</div>
          <div><span className="font-medium text-charcoal">Estimator</span> — Create and manage estimates</div>
          <div><span className="font-medium text-charcoal">Crew Leader</span> — View and update assigned jobs</div>
          <div><span className="font-medium text-charcoal">Crew Member</span> — Clock in/out, view schedule</div>
          <div><span className="font-medium text-charcoal">Snow Ops Manager</span> — Snow events and routes</div>
          <div><span className="font-medium text-charcoal">Inventory Manager</span> — Products and purchase orders</div>
          <div><span className="font-medium text-charcoal">Bookkeeper</span> — Invoices and payments</div>
          <div><span className="font-medium text-charcoal">Read Only</span> — View-only access</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {profiles.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No team members found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden md:table-cell">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase hidden sm:table-cell">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-charcoal">
                      {profile.first_name} {profile.last_name}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-muted hidden md:table-cell">{profile.email}</td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        profile.status === "active"
                          ? "bg-lawn/10 text-lawn"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {profile.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <RoleSelect
                      profileId={profile.id}
                      currentRole={profile.role ?? "read_only"}
                      roleLabels={ROLE_LABELS}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
