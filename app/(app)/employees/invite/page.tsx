import { redirect } from "next/navigation";
import { requireStaffUser } from "@/lib/api/auth";
import InviteEmployeeForm from "./InviteEmployeeForm";

export default async function InviteEmployeePage() {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) redirect("/dashboard");
  return <main className="max-w-lg space-y-5">
    <h1 className="text-2xl font-bold">Invite staff member</h1>
    <p className="text-sm text-muted">The worker receives an email link and completes MFA on this website. Work access begins only after they accept the invitation.</p>
    <InviteEmployeeForm />
  </main>;
}
