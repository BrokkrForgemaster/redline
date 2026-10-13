import { redirect } from "next/navigation";
import { requireStaffUser } from "@/lib/api/auth";
import { hasRecentTotp } from "@/lib/auth/recent-mfa";
import RecoveryQueue from "./RecoveryQueue";

export default async function OwnerRecoveryPage() {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) redirect("/dashboard");
  const assurance = await access.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2" ||
      !hasRecentTotp(assurance.data.currentAuthenticationMethods)) {
    redirect("/mfa/challenge?next=%2Fsettings%2Fsecurity%2Frecovery");
  }
  const { data: requests, error } = await access.supabase.from("mfa_recovery_requests")
    .select("id,user_id,reason,status,requested_at,reviewed_by,provider_error")
    .in("status", ["pending", "provider_pending"])
    .order("requested_at", { ascending: true });
  if (error) throw new Error("Recovery requests are unavailable.");
  const ids = [...new Set((requests ?? []).map(item => item.user_id))];
  const profiles = ids.length ? await access.supabase.from("profiles")
    .select("id,email,first_name,last_name").in("id", ids) : { data: [], error: null };
  if (profiles.error) throw new Error("Recovery account details are unavailable.");
  const accountById = new Map((profiles.data ?? []).map(item => [item.id, item]));
  return <main className="max-w-3xl space-y-5">
    <h1 className="text-2xl font-bold">MFA recovery requests</h1>
    <p className="text-sm text-muted">Verify the person outside this website before approving a factor reset. A request or password email alone does not prove identity. Your own factor requires provider-assisted recovery.</p>
    <RecoveryQueue requests={(requests ?? []).map(item => ({ ...item,
      account: accountById.get(item.user_id) ?? null }))} />
  </main>;
}
