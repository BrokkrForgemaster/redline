import { describe, expect, it, vi } from "vitest";
import { loadAssignmentScope } from "./assignment-scope";

function database(rows: Record<string, unknown[]>, failedTable?: string) {
  const from = vi.fn((table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    const columnValue = (row: Record<string, unknown>, column: string) =>
      column.split(".").reduce<unknown>((value, part) =>
        value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, row);
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters.push(row => columnValue(row, column) === value);
        return query;
      },
      in: (column: string, values: unknown[]) => {
        filters.push(row => values.includes(columnValue(row, column)));
        return query;
      },
      order: () => query,
      then: (resolve: (value: unknown) => void) => resolve({
        data: (rows[table] ?? []).filter(row => filters.every(filter => filter(row as Record<string, unknown>))),
        error: table === failedTable ? { message: "denied" } : null,
      }),
    };
    return query;
  });
  return { from } as never;
}

describe("current company and crew assignment scope", () => {
  it("gives a company manager its own crews without exposing another company", async () => {
    const sb = database({
      crew_members: [],
      subcontractor_memberships: [{ user_id: "manager", active: true,
        subcontractor_company_id: "company-a", role: "manager",
        subcontractor_companies: { status: "active" } }],
      crews: [{ id: "crew-a", active: true, subcontractor_company_id: "company-a" },
        { id: "crew-b", active: true, subcontractor_company_id: "company-b" }],
    });
    const scope = await loadAssignmentScope(sb, "manager", "subcontractor");
    expect(scope.visibleCrewIds).toEqual(["crew-a"]);
    expect(scope.supervisorCompanyIds).toEqual(["company-a"]);
    expect((sb as { from: ReturnType<typeof vi.fn> }).from).toHaveBeenCalledWith("crews");
  });

  it("keeps a company worker on explicitly joined crews only", async () => {
    const sb = database({
      crew_members: [{ employee_id: "worker", crew_id: "crew-a",
        crews: { active: true, subcontractor_company_id: "company-a" } }],
      subcontractor_memberships: [{ user_id: "worker", active: true,
        subcontractor_company_id: "company-a", role: "worker",
        subcontractor_companies: { status: "active" } }],
      crews: [{ id: "crew-b", active: true, subcontractor_company_id: "company-a" }],
    });
    const scope = await loadAssignmentScope(sb, "worker", "subcontractor");
    expect(scope.visibleCrewIds).toEqual(["crew-a"]);
    expect(scope.supervisorCrewIds).toEqual([]);
  });

  it("does not turn a Redline worker or stale company membership into company scope", async () => {
    const sb = database({
      crew_members: [{ employee_id: "worker", crew_id: "crew-a",
        crews: { active: true, subcontractor_company_id: "company-a" } }],
      subcontractor_memberships: [{ user_id: "worker", active: true,
        subcontractor_company_id: "company-a", role: "manager",
        subcontractor_companies: { status: "active" } }],
      crews: [{ id: "crew-a", active: true, subcontractor_company_id: "company-a" }],
    });
    const scope = await loadAssignmentScope(sb, "worker", "mowing_crew_laborer");
    expect(scope.visibleCrewIds).toEqual([]);
    await expect(loadAssignmentScope(database({}, "subcontractor_memberships"), "worker", "subcontractor"))
      .rejects.toThrow("Could not verify current assignments");
  });
});
