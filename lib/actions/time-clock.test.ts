import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStaffUser, from } = vi.hoisted(() => ({ requireStaffUser: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ requireStaffUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { clockInWorkday, clockOutWorkday } from "./time-clock";

const entryId = "7faf9c16-c87b-4da3-bcee-40361b0d14c9";
const userId = "9fe9179c-3805-48d5-af4a-f53607876287";

describe("personal clock boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffUser.mockResolvedValue({ ok: true, supabase: { from }, user: { id: userId } });
  });

  it("denies nonstaff or insufficient MFA before database access", async () => {
    requireStaffUser.mockResolvedValue({ ok: false });
    expect(await clockInWorkday()).toHaveProperty("error");
    expect(await clockOutWorkday(entryId)).toHaveProperty("error");
    expect(from).not.toHaveBeenCalled();
  });

  it("does not create a second open entry", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: entryId }], error: null });
    from.mockReturnValue({ select: () => ({ eq: () => ({ is: () => ({ limit }) }) }) });
    expect(await clockInWorkday()).toHaveProperty("error");
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("scopes clock out to the caller's open personal entry", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const lastIs = vi.fn(() => ({ select }));
    const firstIs = vi.fn(() => ({ is: lastIs }));
    const secondEq = vi.fn(() => ({ is: firstIs }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    from.mockReturnValue({ update });
    expect(await clockOutWorkday(entryId)).toHaveProperty("error");
    expect(firstEq).toHaveBeenCalledWith("id", entryId);
    expect(secondEq).toHaveBeenCalledWith("employee_id", userId);
    expect(firstIs).toHaveBeenCalledWith("job_id", null);
    expect(lastIs).toHaveBeenCalledWith("clock_out", null);
  });
});
