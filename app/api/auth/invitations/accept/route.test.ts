import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient, createAdminClient } = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient, createAdminClient }));

import { POST } from "./route";

function setup(options: { level?: "aal1" | "aal2"; status?: string; invitationStatus?: string } = {}) {
  const level = options.level ?? "aal2";
  const updateUser = vi.fn().mockResolvedValue({ error: null });
  createClient.mockResolvedValue({ auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: {
      id: "user-1", email: "worker@example.com",
    } }, error: null }),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
      data: { currentLevel: level, nextLevel: "aal2", currentAuthenticationMethods: [
        { method: "totp", timestamp: Math.floor(Date.now() / 1000) },
      ] }, error: null,
    }) },
    updateUser,
  } });
  const rpc = vi.fn().mockResolvedValue({ data: "mowing_crew_laborer", error: null });
  const profileQuery = { single: vi.fn().mockResolvedValue({ data: {
    id: "user-1", email: "worker@example.com", status: options.status ?? "invited",
    role: "mowing_crew_laborer",
  }, error: null }) };
  const invitationQuery = { single: vi.fn().mockResolvedValue({ data: {
    id: "invitation-1", status: options.invitationStatus ?? "pending",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  }, error: null }) };
  const from = vi.fn((table: string) => ({ select: () => ({
    eq: () => table === "profiles" ? profileQuery : {
      eq: () => invitationQuery,
    },
  }) }));
  createAdminClient.mockReturnValue({ from, rpc });
  return { rpc, updateUser };
}

function request(password = "Long unique passphrase 2026!") {
  return new NextRequest("https://www.redlinelandscapingky.com/api/auth/invitations/accept", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, confirmPassword: password }),
  });
}

describe("staff invitation acceptance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a first-factor session before using service role", async () => {
    setup({ level: "aal1" });
    expect((await POST(request())).status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a profile that is already active", async () => {
    const { rpc } = setup({ status: "active" });
    expect((await POST(request())).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("activates only the authenticated invited user through the service-only function", async () => {
    const { rpc, updateUser } = setup();
    expect((await POST(request())).status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ password: "Long unique passphrase 2026!" });
    expect(rpc).toHaveBeenCalledWith("accept_staff_invitation", { p_user_id: "user-1" });
  });

  it("does not activate when password confirmation is invalid", async () => {
    const { rpc, updateUser } = setup();
    const bad = new NextRequest("https://www.redlinelandscapingky.com/api/auth/invitations/accept", {
      method: "POST", body: JSON.stringify({ password: "Long unique passphrase 2026!", confirmPassword: "different" }),
    });
    expect((await POST(bad)).status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects the previous passwordless activation request", async () => {
    const { rpc, updateUser } = setup();
    const oldRequest = new NextRequest("https://www.redlinelandscapingky.com/api/auth/invitations/accept", {
      method: "POST",
    });
    expect((await POST(oldRequest)).status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("leaves the invitation pending when Auth refuses the password", async () => {
    const { rpc, updateUser } = setup();
    updateUser.mockResolvedValue({ error: { message: "Auth unavailable" } });
    expect((await POST(request())).status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });
});
