import { describe, expect, it } from "vitest";
import { hasRecentTotp } from "./recent-mfa";

describe("recent MFA", () => {
  const now = 1_800_000_000;
  it("accepts a recent authenticator verification", () => {
    expect(hasRecentTotp([{ method: "password", timestamp: now - 10 },
      { method: "totp", timestamp: now - 30 }], now)).toBe(true);
  });
  it("rejects stale, absent, or un-timestamped claims", () => {
    expect(hasRecentTotp([{ method: "totp", timestamp: now - 901 }], now)).toBe(false);
    expect(hasRecentTotp(["totp"], now)).toBe(false);
    expect(hasRecentTotp([{ method: "otp", timestamp: now }], now)).toBe(false);
    expect(hasRecentTotp([], now)).toBe(false);
  });
});
