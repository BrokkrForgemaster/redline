import { describe, expect, it } from "vitest";
import { parseOwnerDashboardTotals } from "./totals";

describe("dashboard total availability", () => {
  it("never presents a missing migration or failed query as zero work", () => {
    expect(parseOwnerDashboardTotals(null, true)).toEqual({
      activeJobCount: null, openWorkOrderCount: null, totalsUnavailable: true,
    });
    expect(parseOwnerDashboardTotals({ active_jobs: null, open_work_orders: 0 }, false).totalsUnavailable).toBe(true);
  });

  it("accepts real zero and nonzero server totals", () => {
    expect(parseOwnerDashboardTotals({ active_jobs: 0, open_work_orders: 12 }, false)).toEqual({
      activeJobCount: 0, openWorkOrderCount: 12, totalsUnavailable: false,
    });
  });
});
