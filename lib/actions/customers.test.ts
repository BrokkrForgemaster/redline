import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStaffUser, from, logAudit } = vi.hoisted(() => ({
  requireStaffUser: vi.fn(), from: vi.fn(), logAudit: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({ requireStaffUser }));
vi.mock("./audit", () => ({ logAudit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createCustomer, updateCustomer } from "./customers";
import type { CustomerInput } from "../validations/customer";

const id = "7faf9c16-c87b-4da3-bcee-40361b0d14c9";
const input = {
  accountType: "business" as const,
  firstName: "Ada",
  lastName: "Fields",
  primaryContact: "Ada Fields",
  email: "ada@example.test",
  taxExempt: false,
  tags: [],
  portalAccess: false,
};

describe("customer update boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffUser.mockResolvedValue({ ok: true, supabase: { from }, user: { id } });
  });

  it("does not write for a caller lacking active owner MFA", async () => {
    requireStaffUser.mockResolvedValue({ ok: false });
    expect(await updateCustomer(id, input)).toHaveProperty("error");
    expect(from).not.toHaveBeenCalled();
  });

  it("reports a zero-row save and does not claim audit success", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });
    expect(await updateCustomer(id, input)).toHaveProperty("error");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ primary_contact: "Ada Fields" }));
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("persists a customer with empty optional fields and returns its id", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    from.mockReturnValue({ insert });
    const result = await createCustomer({ ...input, mobilePhone: "", preferredContact: "" } as unknown as CustomerInput);
    expect(result).toEqual({ id });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ mobile_phone: null, preferred_contact: null, created_by: id }));
  });
});
