import { describe, expect, it } from "vitest";
import { sanitizeAssignments, type AssignmentsResult } from "./useAssignments";

describe("assigned-work privacy", () => {
  it("removes personal customer fields from older downloaded assignments", () => {
    const old = {
      assignments: [{ id: "assignment-1", assignment_type: "employee", work_orders: {
        id: "work-1", title: "Mow", customers: {
          id: "customer-1", first_name: "Private", last_name: "Person",
          email: "private@example.com", business_name: "Acme",
        }, properties: { address_line1: "Main St" },
      } }],
      legacy_jobs: [{ id: "job-1", title: "Snow", customers: {
        id: "customer-2", first_name: "Another", last_name: "Person",
        phone: "555-1234", business_name: null,
      }, properties: { address_line1: "Side St" } }],
      warnings: [],
    } as unknown as AssignmentsResult;
    const safe = sanitizeAssignments(old);
    expect(JSON.stringify(safe)).not.toMatch(/Private|Another|private@example|555-1234|customer-[12]/);
    expect(safe.assignments[0].work_orders?.customers).toEqual({ business_name: "Acme" });
    expect(safe.legacy_jobs[0].customers).toEqual({ business_name: null });
    expect(safe.assignments[0].work_orders?.properties?.address_line1).toBe("Main St");
  });
});
