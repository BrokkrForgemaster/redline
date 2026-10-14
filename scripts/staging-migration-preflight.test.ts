import { describe, expect, it } from "vitest";
import { roleMappingBlockers, validateStagingTarget } from "./staging-migration-preflight.mjs";

const staging = "stagingabcdefgh";
const production = "productionabcd";

describe("staging migration target guard", () => {
  it("accepts only a declared staging direct database host", () => {
    expect(validateStagingTarget(
      `postgresql://postgres:secret@db.${staging}.supabase.co:5432/postgres`, staging, production,
    )).toEqual({ projectRef: staging, connectionKind: "direct" });
  });

  it("accepts a staging pooler only when its username carries that project ref", () => {
    expect(validateStagingTarget(
      `postgresql://postgres.${staging}:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
      staging, production,
    ).connectionKind).toBe("pooler");
    expect(() => validateStagingTarget(
      `postgresql://postgres.${production}:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
      staging, production,
    )).toThrow();
  });

  it("rejects the production project and unknown hosts", () => {
    expect(() => validateStagingTarget(
      `postgresql://postgres:secret@db.${production}.supabase.co:5432/postgres`,
      production, production,
    )).toThrow();
    expect(() => validateStagingTarget(
      "postgresql://postgres:secret@localhost:5432/postgres", staging, production,
    )).toThrow();
  });
});

describe("owner-approved legacy role mapping", () => {
  it("allows only the single approved crew member before migration 024", () => {
    expect(roleMappingBlockers({ activeLegacyCrewMembers: 1, activeUnmappedLegacyRoles: 0 }, ['023']))
      .toEqual([]);
    expect(roleMappingBlockers({ activeLegacyCrewMembers: 2, activeUnmappedLegacyRoles: 0 }, ['023']))
      .toHaveLength(1);
    expect(roleMappingBlockers({ activeLegacyCrewMembers: 0, activeUnmappedLegacyRoles: 0 }, ['023']))
      .toHaveLength(1);
    expect(roleMappingBlockers({ activeLegacyCrewMembers: 1, activeUnmappedLegacyRoles: 1 }, ['023']))
      .toHaveLength(1);
  });

  it("requires the legacy role to be gone once migration 024 is recorded", () => {
    expect(roleMappingBlockers({ activeLegacyCrewMembers: 0, activeUnmappedLegacyRoles: 0 }, ['024']))
      .toEqual([]);
    expect(roleMappingBlockers({ activeLegacyCrewMembers: 1, activeUnmappedLegacyRoles: 0 }, ['024']))
      .toHaveLength(1);
  });
});
