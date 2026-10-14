import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireStaffUser } from "@/lib/api/auth";
import { hasRecentTotp } from "@/lib/auth/recent-mfa";
import { createAdminClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  identityMethod: z.enum(["in_person", "known_callback"]),
  reviewNote: z.string().trim().min(10).max(500),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const access = await requireStaffUser("reviewer");
  if (!access.ok) return access.response;
  const assurance = await access.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2" ||
      !hasRecentTotp(assurance.data.currentAuthenticationMethods)) {
    return NextResponse.json({ error: "Verify your authenticator again before approving recovery." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Identity verification details are required." }, { status: 400 });

  const { data: targetUserId, error: beginError } = await access.supabase.rpc("begin_mfa_recovery", {
    p_request_id: id, p_identity_method: parsed.data.identityMethod,
    p_review_note: parsed.data.reviewNote,
  });
  if (beginError || typeof targetUserId !== "string") {
    return NextResponse.json({ error: "Recovery approval could not be saved." }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data: factors, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: targetUserId });
  if (listError || !factors) {
    await admin.from("mfa_recovery_requests").update({ provider_error: "factor_list_failed" })
      .eq("id", id).eq("status", "provider_pending");
    return NextResponse.json({ error: "The provider did not return factors. Retry is available." }, { status: 502 });
  }
  for (const factor of factors.factors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: targetUserId, id: factor.id });
    if (error) {
      await admin.from("mfa_recovery_requests").update({ provider_error: "factor_delete_failed" })
        .eq("id", id).eq("status", "provider_pending");
      return NextResponse.json({ error: "The provider reset is incomplete. Retry is available." }, { status: 502 });
    }
  }
  const { error: completeError } = await admin.rpc("complete_mfa_recovery", { p_request_id: id });
  if (completeError) {
    return NextResponse.json({ error: "Factors were removed, but completion recording needs retry." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
