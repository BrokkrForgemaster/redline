import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createClient();

  let error: unknown = new Error("Missing recovery credentials");
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && (type === "recovery" || type === "invite")) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  }
  if (!error) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) error = new Error("Recovery session unavailable");
  }

  const destination = new URL(error
    ? type === "invite" ? "/login?error=invalid_invitation" : "/forgot-password?error=invalid_link"
    : type === "invite"
      ? "/auth/mfa/enroll?next=%2Fauth%2Finvitation%2Faccept"
      : "/reset-password", url.origin);
  return NextResponse.redirect(destination);
}
