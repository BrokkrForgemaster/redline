export const ASSIGNABLE_STAFF_ROLES = [
  "mowing_crew_lead",
  "mowing_crew_laborer",
  "snow_plow_operator",
  "subcontractor",
] as const;

export type AssignableStaffRole = typeof ASSIGNABLE_STAFF_ROLES[number];

export function isOperationalRole(role: string): boolean {
  return role === "owner" || ASSIGNABLE_STAFF_ROLES.some(allowed => allowed === role);
}

export function isAdminRole(role: string): boolean {
  return role === "owner";
}

export function canAssignStaffRole(actorRole: string, targetRole: string, requestedRole: string): boolean {
  return isAdminRole(actorRole)
    && targetRole !== "owner"
    && targetRole !== "developer"
    && ASSIGNABLE_STAFF_ROLES.some(allowed => allowed === requestedRole);
}
