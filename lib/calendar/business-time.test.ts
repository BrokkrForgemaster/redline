import { describe, expect, it } from "vitest";
import { toBusinessWallDate } from "./business-time";

describe("business calendar timestamps", () => {
  it("shows the configured property's local date across a UTC month boundary", () => {
    const wallDate = toBusinessWallDate("2026-11-01T02:30:00Z", "America/New_York");
    expect([wallDate.getFullYear(), wallDate.getMonth(), wallDate.getDate(), wallDate.getHours(), wallDate.getMinutes()])
      .toEqual([2026, 9, 31, 22, 30]);
  });

  it("rejects malformed instants and timezones", () => {
    expect(() => toBusinessWallDate("invalid", "America/New_York")).toThrow();
    expect(() => toBusinessWallDate("2026-10-01T00:00:00Z", "invalid/timezone")).toThrow();
  });
});
