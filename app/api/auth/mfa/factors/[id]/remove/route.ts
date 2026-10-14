import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasRecentTotp } from "@/lib/auth/recent-mfa";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid factor." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("status").eq("id", user.id).single();
  if (profileError || !["active", "invited"].includes(profile?.status ?? "")) {
    return NextResponse.json({ error: "Account unavailable." }, { status: 403 });
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2" ||
      assurance.data.nextLevel !== "aal2" ||
      !hasRecentTotp(assurance.data.currentAuthenticationMethods)) {
    return NextResponse.json({ error: "Verify your authenticator again." }, { status: 403 });
  }
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error || !factors.data) return NextResponse.json({ error: "Factors unavailable." }, { status: 502 });
  const verified = factors.data.totp.filter(factor => factor.status === "verified");
  if (!verified.some(factor => factor.id === id) || verified.length < 2) {
    return NextResponse.json({ error: "Add and verify a replacement before removing this factor." }, { status: 409 });
  }
  const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
  if (error) return NextResponse.json({ error: "Factor could not be removed." }, { status: 502 });
  await supabase.auth.refreshSession();
  return NextResponse.json({ success: true });
}
