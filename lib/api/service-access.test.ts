import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, from, loadAssignmentScope } = vi.hoisted(() => ({
  createAdminClient: vi.fn(), from: vi.fn(), loadAssignmentScope: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));
vi.mock("./assignment-scope", () => ({ loadAssignmentScope }));

import { requireWorkOrderAccess } from "./service-access";

function mockScope(role: string, crewCompany: string | null, activeCompany: string | null) {
  loadAssignmentScope.mockResolvedValue({
    visibleCrewIds: role === "subcontractor" && crewCompany === activeCompany && activeCompany
      ? ["crew-1"] : [],
    companyIds: role === "subcontractor" && activeCompany ? [activeCompany] : [],
  });
  from.mockImplementation((table: string) => {
    let assignmentType = "";
    const data = table === "profiles" ? { role, status: "active" }
      : table === "work_orders" ? { id: "work-1" }
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

  it("allows a current subcontractor supervisor on its company crew assignment", async () => {
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
