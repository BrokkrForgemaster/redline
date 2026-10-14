import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient, createAdminClient } = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient, createAdminClient }));
import { POST } from "./route";

const body = { currentPassword: "Temporary-Secret-123", newPassword: "New-Strong-Password-456",
  confirmPassword: "New-Strong-Password-456" };
const request = (value = body) => new NextRequest("https://portal.example/api/auth/staff-accounts/complete", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
});

function setup(status = "invited", level = "aal2") {
  const updateUser = vi.fn().mockResolvedValue({ error: null });
  createClient.mockResolvedValue({ auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "worker@example.com" } }, error: null }),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: {
      currentLevel: level, nextLevel: "aal2",
      currentAuthenticationMethods: [{ method: "totp", timestamp: Math.floor(Date.now() / 1000) }],
    }, error: null }) }, updateUser,
  } });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => ({ select: () => ({ eq: () => ({ single: async () => ({
    data: table === "profiles"
      ? { id: "user-1", email: "worker@example.com", status, role: "crew_member" }
      : { user_id: "user-1", email: "worker@example.com", status: "pending" },
    error: null,
  }) }) }) }));
  createAdminClient.mockReturnValue({ from, rpc });
  return { updateUser, rpc };
}

describe("first-login staff setup", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects first-factor-only sessions", async () => {
    const { updateUser, rpc } = setup("invited", "aal1");
    expect((await POST(request())).status).toBe(403);
    expect(updateUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects an already active account", async () => {
    const { updateUser, rpc } = setup("active");
    expect((await POST(request())).status).toBe(403);
    expect(updateUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires actual current-password verification before activation", async () => {
    const { updateUser, rpc } = setup();
    updateUser.mockResolvedValue({ error: { message: "wrong password" } });
    expect((await POST(request())).status).toBe(400);
    expect(updateUser).toHaveBeenCalledWith({ password: body.newPassword,
      current_password: body.currentPassword });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("activates only after password change succeeds", async () => {
    const { updateUser, rpc } = setup();
    expect((await POST(request())).status).toBe(200);
    expect(updateUser).toHaveBeenCalledBefore(rpc);
    expect(rpc).toHaveBeenCalledWith("complete_staff_account_setup", { p_user_id: "user-1" });
  });
});
