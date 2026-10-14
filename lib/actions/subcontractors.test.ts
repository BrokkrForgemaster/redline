import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStaffUser, rpc } = vi.hoisted(() => ({
  requireStaffUser: vi.fn(), rpc: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({ requireStaffUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addSubcontractorToCompany, createSubcontractorCompany } from "./subcontractors";

const company = "7faf9c16-c87b-4da3-bcee-40361b0d14c9";
const worker = "1dcf5188-cf70-47e9-b2f7-05dfb427a6fa";

describe("owner subcontractor boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffUser.mockResolvedValue({ ok: true, supabase: { rpc } });
    rpc.mockResolvedValue({ data: company, error: null });
  });

  it("rejects non-Admin before calling the company command", async () => {
    requireStaffUser.mockResolvedValue({ ok: false });
    expect(await createSubcontractorCompany("North Services")).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends only the selected company and user to the database command", async () => {
    expect(await addSubcontractorToCompany(company, worker, "manager")).toEqual({ id: company });
    expect(rpc).toHaveBeenCalledWith("manage_subcontractor_company", {
      p_action: "add_member", p_company_id: company,
      p_payload: { user_id: worker, membership_role: "manager" },
    });
  });

  it("reports a rejected or failed company membership instead of success", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023" } });
    expect(await addSubcontractorToCompany(company, worker, "manager")).toHaveProperty("error");
    expect(await addSubcontractorToCompany("wrong-id", worker, "manager")).toHaveProperty("error");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
