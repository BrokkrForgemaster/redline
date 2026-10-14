import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { apiError } from "./errors";
import { ASSIGNABLE_STAFF_ROLES } from "@/lib/auth/roles";

export type ApiSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function requireApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile, error } = await supabase.from("profiles")
      .select("status").eq("id", user.id).single();
    if (error || profile?.status !== "active") {
      return { ok: false as const, response: apiError(403, "ACCOUNT_INACTIVE", "Account is not active.") };
    }
    if (!(await hasMfaAssurance(supabase))) {
      return { ok: false as const, response: apiError(403, "MFA_REQUIRED", "Verified MFA is required.") };
    }
    return {
      ok: true as const,
      supabase,
      user,
    };
  }

  const authorization = (await import("next/headers")).headers;
  const authHeader = (await authorization()).get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    return {
      ok: false as const,
      response: apiError(401, "AUTH_REQUIRED", "Authentication is required."),
    };
  }

  const admin = createAdminClient();
  const {
    data: { user: tokenUser },
  } = await admin.auth.getUser(token);

  if (!tokenUser) {
    return {
      ok: false as const,
      response: apiError(401, "AUTH_REQUIRED", "Authentication is required."),
    };
  }

  const { data: tokenProfile, error: profileError } = await admin.from("profiles")
    .select("status").eq("id", tokenUser.id).single();
  if (profileError || tokenProfile?.status !== "active") {
    return { ok: false as const, response: apiError(403, "ACCOUNT_INACTIVE", "Account is not active.") };
  }
  if (!(await hasMfaAssurance(admin, token))) {
    return { ok: false as const, response: apiError(403, "MFA_REQUIRED", "Verified MFA is required.") };
  }

  return {
    ok: true as const,
    supabase,
    user: tokenUser,
  };
}

export const STAFF_ROLES = [
  "owner",
  ...ASSIGNABLE_STAFF_ROLES,
] as const;

export const REVIEWER_ROLES = ["owner"] as const;

export async function hasMfaAssurance(supabase: ApiSupabaseClient, token?: string): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(token);
  return !error && data?.currentLevel === "aal2" && data?.nextLevel === "aal2";
}

export async function requireStaffUser(minRole: "staff" | "reviewer" = "staff") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: apiError(401, "AUTH_REQUIRED", "Authentication is required."),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, status")
    .eq("id", user.id)
    .single();

  const allowed = profile?.status === "active" && (minRole === "reviewer"
    ? (REVIEWER_ROLES as readonly string[]).includes(profile?.role ?? "")
    : (STAFF_ROLES as readonly string[]).includes(profile?.role ?? ""));

  if (!allowed) {
    return {
      ok: false as const,
      response: apiError(403, "FORBIDDEN", "You do not have permission to perform this action."),
    };
  }

  if (!(await hasMfaAssurance(supabase))) {
    return { ok: false as const, response: apiError(403, "FORBIDDEN", "Verified MFA is required.") };
  }

  return { ok: true as const, supabase, user, profile };
}

export function mapRole(role: string) {
  if (role === "owner") return "admin";
  if (role === "developer") return "developer";
  return role;
}
