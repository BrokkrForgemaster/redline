import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetupForm from "./SetupForm";

export default async function StaffSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles")
    .select("status").eq("id", user.id).single();
  if (profile?.status === "active") redirect("/dashboard");
  if (profile?.status !== "invited") return <main className="mx-auto max-w-md p-6">
    <h1 className="text-2xl font-semibold">Account unavailable</h1>
    <p>Ask the owner to review your account.</p>
  </main>;
  const { data: setup } = await supabase.from("staff_account_setups")
    .select("status").eq("user_id", user.id).maybeSingle();
  if (setup?.status !== "pending") return <main className="mx-auto max-w-md p-6">
    <h1 className="text-2xl font-semibold">Setup unavailable</h1>
    <p>Ask the owner to review your account.</p>
  </main>;
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2" || assurance.nextLevel !== "aal2") {
    redirect(assurance?.nextLevel === "aal2"
      ? "/mfa/challenge?next=%2Fauth%2Fsetup"
      : "/auth/mfa/enroll?next=%2Fauth%2Fsetup");
  }
  return <main className="mx-auto max-w-md space-y-4 p-6">
    <h1 className="text-2xl font-semibold">Finish staff account setup</h1>
    <p>Change the initial password the owner gave you. Work access starts after this change and authenticator verification.</p>
    <SetupForm />
  </main>;
}
