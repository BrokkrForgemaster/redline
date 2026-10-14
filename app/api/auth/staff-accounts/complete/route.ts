import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hasRecentTotp } from "@/lib/auth/recent-mfa";
import { completeStaffSetupSchema } from "@/lib/validations/auth";

export async function POST(request: NextRequest) {
  const input = completeStaffSetupSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || input.data.currentPassword === input.data.newPassword) {
    return NextResponse.json({ error: "Choose a valid new password different from the initial password." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2" ||
      assurance.data.nextLevel !== "aal2" ||
      !hasRecentTotp(assurance.data.currentAuthenticationMethods)) {
    return NextResponse.json({ error: "Recent authenticator verification is required." }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,email,status,role").eq("id", user.id).single();
  const { data: setup, error: setupError } = await admin.from("staff_account_setups")
    .select("user_id,email,status").eq("user_id", user.id).single();
  if (profileError || setupError || !profile || !setup ||
      profile.status !== "invited" || setup.status !== "pending" ||
      profile.email?.toLowerCase() !== user.email?.toLowerCase() ||
      setup.email !== user.email?.toLowerCase() ||
      ["owner", "developer"].includes(profile.role)) {
    return NextResponse.json({ error: "Pending account setup is unavailable." }, { status: 403 });
  }
  const { error: passwordError } = await supabase.auth.updateUser({
    password: input.data.newPassword, current_password: input.data.currentPassword,
  });
  if (passwordError) {
    return NextResponse.json({ error: "Initial password was incorrect or the new password was rejected." }, { status: 400 });
  }
  const { error: activateError } = await admin.rpc("complete_staff_account_setup", { p_user_id: user.id });
  if (activateError) {
    return NextResponse.json({ error: "Password changed, but activation needs review. Sign in with your new password and contact the owner." },
      { status: 409 });
  }
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
