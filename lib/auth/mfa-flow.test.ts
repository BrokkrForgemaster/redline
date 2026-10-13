import { describe, expect, it } from "vitest";
import { mfaDestination, safeAuthNext } from "./mfa-flow";

describe("MFA navigation", () => {
  it("requires a challenge for enrolled first-factor sessions", () => {
    expect(mfaDestination("aal1", "aal2", "/reset-password"))
      .toBe("/mfa/challenge?next=%2Freset-password");
  });

  it("requires enrollment when no factor is verified", () => {
    expect(mfaDestination("aal1", "aal1", "/dashboard"))
      .toBe("/auth/mfa/enroll?next=%2Fdashboard");
  });

  it("allows an AAL2 session and rejects external redirect targets", () => {
    expect(mfaDestination("aal2", "aal2")).toBeNull();
    expect(mfaDestination("aal2", "aal1")).toBe("/auth/mfa/enroll?next=%2Fdashboard");
    expect(safeAuthNext("//evil.example")).toBe("/dashboard");
    expect(safeAuthNext("/\\evil.example")).toBe("/dashboard");
    expect(safeAuthNext("https://evil.example")).toBe("/dashboard");
  });
});
