import { requireApiUser, mapRole } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { getEffectiveRole } from "@/lib/auth/privileged-users";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error } = await (auth.supabase as any)
    .from("profiles")
    .select("id, email, first_name, last_name, phone, avatar_url, role, status, mfa_enabled")
    .eq("id", auth.user.id)
    .single();

  if (error || !profile) {
    return apiError(403, "FORBIDDEN", "Profile is missing or disabled.");
  }

  if (profile.status !== "active") {
    return apiError(403, "FORBIDDEN", "Account is not active.");
  }

  const effectiveRole = getEffectiveRole(auth.user.email, profile.role, profile.email);

  return apiOk({
    user: {
      id: auth.user.id,
      email: auth.user.email,
    },
    profile: {
      ...profile,
      role: effectiveRole,
    },
    effective_role: effectiveRole === "developer" ? "developer" : mapRole(effectiveRole),
  });
}
