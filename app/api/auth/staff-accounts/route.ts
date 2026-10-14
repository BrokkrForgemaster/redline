import { NextResponse, type NextRequest } from "next/server";
import { requireStaffUser } from "@/lib/api/auth";
import { hasRecentTotp } from "@/lib/auth/recent-mfa";
import { provisionStaffSchema } from "@/lib/validations/auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const access = await requireStaffUser("reviewer");
  if (!access.ok) return access.response;
  const assurance = await access.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2" ||
      assurance.data.nextLevel !== "aal2" ||
      !hasRecentTotp(assurance.data.currentAuthenticationMethods)) {
    return NextResponse.json({ error: "Verify your authenticator again before creating an account." }, { status: 403 });
  }
  const input = provisionStaffSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Check the account details and initial password." }, { status: 400 });
  const { email: rawEmail, firstName, lastName, role, initialPassword } = input.data;
  const email = rawEmail.trim().toLowerCase();
  const admin = createAdminClient();
  const { error: schemaError } = await admin.from("staff_account_setups")
    .select("user_id", { count: "exact", head: true }).limit(0);
  if (schemaError) return NextResponse.json({
    error: "Staff account setup is unavailable until the database migration is applied.",
  }, { status: 503 });
  // No role metadata is passed to Auth. The profile trigger creates an invited,
  // nonoperational profile; the owner-authorized RPC records the chosen role.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password: initialPassword, email_confirm: true,
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: "Account could not be created. Review whether this email already has an Auth account." },
      { status: 409 });
  }
  const { error: setupError } = await access.supabase.rpc("register_staff_account_setup", {
    p_user_id: created.user.id, p_email: email,
    p_first_name: firstName.trim(), p_last_name: lastName.trim(), p_role: role,
  });
  if (setupError) {
    // The new Auth user remains invited and cannot access operational data.
    // Preserve it for owner review rather than deleting an identity after an
    // ambiguous provider/database failure.
    return NextResponse.json({ error: "The Auth account was created, but staff setup needs review. Do not reuse the initial password until resolved." },
      { status: 500 });
  }
  return NextResponse.json({ userId: created.user.id, status: "setup_required" }, { status: 201 });
}
