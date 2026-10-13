import { NextResponse, type NextRequest } from "next/server";
import { requireStaffUser } from "@/lib/api/auth";
import { hasRecentTotp } from "@/lib/auth/recent-mfa";
import { inviteEmployeeSchema } from "@/lib/validations/auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) return access.response;
  const assurance = await access.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2" ||
      assurance.data.nextLevel !== "aal2" ||
      !hasRecentTotp(assurance.data.currentAuthenticationMethods)) {
    return NextResponse.json({ error: "Verify your authenticator again before inviting staff." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const input = inviteEmployeeSchema.safeParse(body);
  if (!input.success) return NextResponse.json({ error: "Check the invitation details." }, { status: 400 });

  const portalValue = process.env.REDLINE_PORTAL_URL;
  let portal: URL;
  try {
    if (!portalValue) throw new Error("Missing portal URL");
    portal = new URL(portalValue);
    if (portal.pathname !== "/" || portal.search || portal.hash ||
        (portal.protocol !== "https:" && portal.hostname !== "localhost")) {
      throw new Error("Invalid portal URL");
    }
  } catch {
    return NextResponse.json({ error: "Staff invitations are not configured for this website." }, { status: 503 });
  }
  const email = input.data.email.trim().toLowerCase();
  const admin = createAdminClient();
  const existing = await admin.from("staff_invitations").select("id")
    .eq("email", email).eq("status", "pending").maybeSingle();
  if (existing.error) return NextResponse.json({ error: "Invitation status is unavailable." }, { status: 502 });
  if (existing.data) return NextResponse.json({ error: "An invitation is already pending for this email." }, { status: 409 });

  const { data: invitationId, error: createError } = await access.supabase.rpc("create_staff_invitation", {
    p_email: email, p_first_name: input.data.firstName.trim(),
    p_last_name: input.data.lastName.trim(), p_role: input.data.role,
  });
  if (createError || typeof invitationId !== "string") {
    return NextResponse.json({ error: "Invitation could not be saved." }, { status: 409 });
  }
  const redirectTo = new URL("/auth/callback?type=invite", portal).toString();
  const { data: invited, error: providerError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (providerError || !invited.user) {
    await admin.from("staff_invitations").update({ status: "failed", provider_error: "invite_failed" })
      .eq("id", invitationId).eq("status", "pending");
    return NextResponse.json({ error: "The invitation was saved, but email delivery failed. Review the account before retrying." },
      { status: 502 });
  }
  const { data: saved, error: saveError } = await admin.from("staff_invitations")
    .update({ user_id: invited.user.id }).eq("id", invitationId).eq("status", "pending")
    .select("id").single();
  if (saveError || !saved) {
    return NextResponse.json({ error: "The provider accepted the invitation, but account linking needs review." },
      { status: 500 });
  }
  const profile = await admin.from("profiles").select("id,status").eq("id", invited.user.id).single();
  if (profile.error || profile.data?.status !== "invited") {
    return NextResponse.json({ error: "The invitation was sent, but profile setup needs review." }, { status: 500 });
  }
  return NextResponse.json({ invitationId, status: "pending" }, { status: 201 });
}
