export const ADMIN_EMAIL = "ryangretz@gmail.com";
export const DEVELOPER_EMAIL = "chada.powell@outlook.com";
export const ADMIN_EMAILS = [ADMIN_EMAIL, "ryangretz07@gmail.com"] as const;
export const DEVELOPER_EMAILS = [DEVELOPER_EMAIL, "chad.powell0@gmail.com"] as const;

export type EffectiveRole = "developer" | "owner" | string;

export function getEffectiveRole(
  email: string | null | undefined,
  profileRole: string,
  fallbackEmail?: string | null
): EffectiveRole {
  const emails = [email, fallbackEmail].flatMap((value) => value ? [value.toLowerCase()] : []);
  if (emails.some((value) => (DEVELOPER_EMAILS as readonly string[]).includes(value))) return "developer";
  if (emails.some((value) => (ADMIN_EMAILS as readonly string[]).includes(value))) return "owner";
  return profileRole;
}

export function canViewOperationsDashboard(role: string) {
  return ["developer", "owner"].includes(role);
}
