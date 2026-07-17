import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/app/AppShell";

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

  if (!profile || profile.status === "suspended" || profileError) {
    // Sign out so the middleware won't bounce them back to /dashboard
    await supabase.auth.signOut();
    const error = profile?.status === "suspended" ? "account_suspended" : "account_disabled";
    redirect(`/login?error=${error}`);
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
