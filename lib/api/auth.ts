import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { apiError } from "./errors";

export type ApiSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function requireApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
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

  return {
    ok: true as const,
    supabase,
    user: tokenUser,
  };
}

export const STAFF_ROLES = [
  "owner",
  "developer",
  "administrator",
  "operations_manager",
  "snow_operations_manager",
  "office_manager",
  "crew_leader",
  "estimator",
] as const;

export const REVIEWER_ROLES = ["owner", "developer", "administrator", "operations_manager"] as const;

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
    .select("id, role")
    .eq("id", user.id)
    .single();

  const allowed = minRole === "reviewer"
    ? (REVIEWER_ROLES as readonly string[]).includes(profile?.role ?? "")
    : (STAFF_ROLES as readonly string[]).includes(profile?.role ?? "");

  if (!allowed) {
    return {
      ok: false as const,
      response: apiError(403, "FORBIDDEN", "You do not have permission to perform this action."),
    };
  }

  return { ok: true as const, supabase, user, profile };
}

export function mapRole(role: string) {
  if (role === "owner") return "owner_super_admin";
  if (role === "developer") return "developer";
  if (role === "administrator") return "admin";
  if (["operations_manager", "snow_operations_manager", "crew_leader"].includes(role)) {
    return "supervisor_foreman";
  }
  if (role === "crew_member") return "employee";
  if (role === "read_only") return "auditor_read_only";
  return role;
}
