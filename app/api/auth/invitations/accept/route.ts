import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hasRecentTotp } from "@/lib/auth/recent-mfa";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Invitation session is unavailable." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2" ||
      assurance.data.nextLevel !== "aal2" ||
      !hasRecentTotp(assurance.data.currentAuthenticationMethods)) {
    return NextResponse.json({ error: "Recent authenticator verification is required." }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,email,status,role").eq("id", user.id).single();
  if (profileError || !profile || profile.status !== "invited" ||
      profile.email?.toLowerCase() !== user.email?.toLowerCase() ||
      ["owner", "developer"].includes(profile.role)) {
    return NextResponse.json({ error: "Invited profile is unavailable." }, { status: 403 });
  }
  const { data: invitation, error: invitationError } = await admin.from("staff_invitations")
    .select("id,expires_at,status").eq("user_id", user.id).eq("status", "pending").single();
  if (invitationError || !invitation || new Date(invitation.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Invitation is unavailable or expired." }, { status: 403 });
  }
  const { error } = await admin.rpc("accept_staff_invitation", { p_user_id: user.id });
  if (error) return NextResponse.json({ error: "Account activation could not be completed." }, { status: 409 });
  return NextResponse.json({ success: true });
}
