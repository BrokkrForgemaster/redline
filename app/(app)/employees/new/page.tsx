import { redirect } from "next/navigation";
import { requireStaffUser } from "@/lib/api/auth";
import StaffAccountForm from "../invite/InviteEmployeeForm";

export default async function NewStaffAccountPage() {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) redirect("/dashboard");
  return <main className="max-w-lg space-y-5">
    <h1 className="text-2xl font-bold">Create staff account</h1>
    <p className="text-sm text-muted">Set an initial password and give it to the worker directly after verifying their identity. They must enroll MFA and change the password on first sign-in before work access.</p>
    <StaffAccountForm />
  </main>;
}
