import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasRecentTotp } from "@/lib/auth/recent-mfa";
import { changePasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";

export async function POST(request: NextRequest) {
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = payload as Record<string, unknown>;
  const mode = input.mode;
  const password = input.password;
  const valid = mode === "change"
    ? changePasswordSchema.safeParse({ currentPassword: input.currentPassword,
        newPassword: password, confirmPassword: password }).success
    : mode === "reset"
      ? resetPasswordSchema.safeParse({ password, confirmPassword: password }).success
      : false;
  if (!valid || typeof password !== "string") {
    return NextResponse.json({ error: "Password requirements were not met." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("status").eq("id", user.id).single();
  if (profileError || !["active", "invited"].includes(profile?.status ?? "")) {
    return NextResponse.json({ error: "Account access is unavailable." }, { status: 403 });
  }
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2" ||
      !hasRecentTotp(assurance.currentAuthenticationMethods)) {
    return NextResponse.json({ error: "Recent authenticator verification is required." }, { status: 403 });
  }

  const { error: updateError } = await supabase.auth.updateUser(mode === "change"
    ? { password, current_password: input.currentPassword as string }
    : { password });
  if (updateError) {
    return NextResponse.json({ error: "Password could not be updated. Check your current password or request a new link." },
      { status: 400 });
  }
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
