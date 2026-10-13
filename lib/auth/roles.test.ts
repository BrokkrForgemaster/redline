import { describe, expect, it } from "vitest";
import { canAssignStaffRole, isAdminRole, isOperationalRole } from "./roles";

describe("owner-only role boundaries", () => {
  it("does not infer Admin or business access from developer and legacy roles", () => {
    for (const role of ["developer", "administrator", "operations_manager", "crew_member", "crew_leader"]) {
      expect(isAdminRole(role)).toBe(false);
      expect(isOperationalRole(role)).toBe(false);
    }
    expect(isAdminRole("owner")).toBe(true);
    for (const role of ["mowing_crew_lead", "mowing_crew_laborer", "snow_plow_operator", "subcontractor"]) {
      expect(isOperationalRole(role)).toBe(true);
      expect(isAdminRole(role)).toBe(false);
    }
  });

  it("prevents the generic editor from granting Admin or Developer or changing either protected account", () => {
    expect(canAssignStaffRole("owner", "mowing_crew_laborer", "snow_plow_operator")).toBe(true);
    expect(canAssignStaffRole("developer", "mowing_crew_laborer", "snow_plow_operator")).toBe(false);
    expect(canAssignStaffRole("owner", "mowing_crew_laborer", "owner")).toBe(false);
    expect(canAssignStaffRole("owner", "owner", "mowing_crew_laborer")).toBe(false);
    expect(canAssignStaffRole("owner", "developer", "subcontractor")).toBe(false);
  });
});
