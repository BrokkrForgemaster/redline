import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStaffUser, single, update } = vi.hoisted(() => ({
  requireStaffUser: vi.fn(), single: vi.fn(), update: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({ requireStaffUser }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from: () => ({
    select: () => ({ eq: () => ({ single }) }), update,
  }) }),
}));

import { POST } from "./route";

describe("legacy approval compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffUser.mockResolvedValue({ ok: true });
  });

  it("cannot promote an unverified submitted visit", async () => {
    single.mockResolvedValue({ data: { id: "visit", status: "submitted" }, error: null });
    const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "visit" }) });
    expect(response.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("acknowledges a visit already completed by the canonical command", async () => {
    single.mockResolvedValue({ data: { id: "visit", status: "completed" }, error: null });
    const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "visit" }) });
    expect(response.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });
});
