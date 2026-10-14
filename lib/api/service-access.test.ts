import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, from } = vi.hoisted(() => ({
  createAdminClient: vi.fn(), from: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));

import { requireWorkOrderAccess } from "./service-access";

function mockScope(role: string, crewCompany: string | null, activeCompany: string | null) {
  from.mockImplementation((table: string) => {
    let assignmentType = "";
    const data = table === "profiles" ? { role, status: "active" }
      : table === "work_orders" ? { id: "work-1" }
      : table === "subcontractor_memberships" ? activeCompany
        ? [{ subcontractor_company_id: activeCompany }] : []
      : table === "crew_members" ? [{ crew_id: "crew-1", crews: { subcontractor_company_id: crewCompany } }]
      : [];
    const query = {
      select: () => query,
      eq: (column: string, value: string) => {
        if (column === "assignment_type") assignmentType = value;
        return query;
      },
      in: () => query,
      single: async () => ({ data, error: null }),
      limit: async () => ({ data: table === "work_order_assignments" && assignmentType === "crew"
        ? [{ id: "crew-assignment" }] : [], error: null }),
      then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
    };
    return query;
  });
}

describe("service-role crew company scope", () => {
  beforeEach(() => { vi.clearAllMocks(); createAdminClient.mockReturnValue({ from }); });

  it("allows a current subcontractor company member on its crew assignment", async () => {
    mockScope("subcontractor", "company-a", "company-a");
    expect((await requireWorkOrderAccess({} as never, "worker-1", "work-1")).ok).toBe(true);
  });

  it("rejects stale, cross-company, and mixed Redline crew memberships", async () => {
    for (const [role, crewCompany, activeCompany] of [
      ["subcontractor", "company-a", null],
      ["subcontractor", "company-a", "company-b"],
      ["subcontractor", null, "company-a"],
      ["mowing_crew_laborer", "company-a", "company-a"],
    ] as const) {
      mockScope(role, crewCompany, activeCompany);
      expect((await requireWorkOrderAccess({} as never, "worker-1", "work-1")).ok).toBe(false);
    }
  });
});
