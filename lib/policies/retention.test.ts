import { describe, expect, it } from "vitest";
import { isRetentionEligible } from "./retention";

describe("retention eligibility", () => {
  const now = new Date("2026-10-05T12:00:00.000Z");

  it("allows expired continuous breadcrumbs to be purged", () => {
    expect(
      isRetentionEligible({
        retentionClass: "continuousBreadcrumb",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        now,
      })
    ).toBe(true);
  });

  it("blocks purge when legal hold exists", () => {
    expect(
      isRetentionEligible({
        retentionClass: "continuousBreadcrumb",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        now,
        hasLegalHold: true,
      })
    ).toBe(false);
  });

  it("blocks child purge while parent retention is active", () => {
    expect(
      isRetentionEligible({
        retentionClass: "routineEvidencePhoto",
        createdAt: new Date("2018-01-01T12:00:00.000Z"),
        now,
        parentRetainedUntil: new Date("2027-01-01T00:00:00.000Z"),
      })
    ).toBe(false);
  });
});
