import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/app/AppShell";
import { mfaDestination } from "@/lib/auth/mfa-flow";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active" || profileError) {
    // Sign out so the middleware won't bounce them back to /dashboard
    await supabase.auth.signOut();
    const error = profile?.status === "suspended" ? "account_suspended" : "account_disabled";
    redirect(`/login?error=${error}`);
  }

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || !assurance) redirect("/mfa/challenge");
  const destination = mfaDestination(assurance.currentLevel, assurance.nextLevel);
  if (destination) redirect(destination);

  return <AppShell profile={profile}>{children}</AppShell>;
}
