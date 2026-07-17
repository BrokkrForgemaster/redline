import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, UserCog } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatPhone } from "@/lib/utils/format";

export const metadata = { title: "Employees" };

type EmployeeStatus = "active" | "inactive" | "invited" | "suspended";

function employeeStatusBadge(status: string): {
  label: string;
  variant: "green" | "red" | "yellow" | "gray";
} {
  const map: Record<string, { label: string; variant: "green" | "red" | "yellow" | "gray" }> = {
    active: { label: "Active", variant: "green" },
    suspended: { label: "Suspended", variant: "red" },
    invited: { label: "Invited", variant: "yellow" },
    inactive: { label: "Inactive", variant: "gray" },
  };
  return map[status] ?? { label: status, variant: "gray" };
}

interface SearchParams {
  status?: string;
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, email, first_name, last_name, phone, role, status, last_sign_in_at")
    .neq("role", "customer")
    .order("last_name");

  if (status && status !== "all") {
    query = query.eq("status", status as EmployeeStatus);
  }

  const { data: employees } = await query;

  const tabs = ["all", "active", "inactive"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Employees</h1>
          <p className="text-sm text-muted">{employees?.length ?? 0} total</p>
        </div>
        <Link
          href="/employees/invite"
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Plus size={16} />
          Invite Employee
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={tab === "all" ? "/employees" : `/employees?status=${tab}`}
            className={
              (status ?? "all") === tab
                ? "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors bg-charcoal text-white"
                : "px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors bg-white border border-gray-200 text-muted hover:bg-gray-50"
            }
          >
            {tab}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!employees || employees.length === 0 ? (
          <div className="py-16 text-center">
            <UserCog size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-charcoal">No employees found</p>
            <p className="text-sm text-muted mt-1">
              {status && status !== "all"
                ? `No ${status} employees`
                : "Invite your first employee to get started"}
            </p>
            <Link
              href="/employees/invite"
              className="mt-4 inline-block text-sm text-redline hover:underline"
            >
              Invite Employee
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                    Email
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                    Role
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                    Last Sign In
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map((employee) => {
                  const badge = employeeStatusBadge(employee.status ?? "inactive");
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/employees/${employee.id}`} className="block">
                          <p className="font-medium text-charcoal hover:text-redline transition-colors">
                            {employee.first_name} {employee.last_name}
                          </p>
                          {employee.phone && (
                            <p className="text-xs text-muted">
                              {formatPhone(employee.phone)}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted hidden md:table-cell">
                        {employee.email ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-muted capitalize hidden sm:table-cell">
                        {employee.role?.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge label={badge.label} variant={badge.variant} />
                      </td>
                      <td className="px-5 py-3 text-muted hidden lg:table-cell">
                        {formatDate(employee.last_sign_in_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
