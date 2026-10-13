import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient } = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient, createAdminClient }));

import { POST } from "./route";

function setup(options: { level?: "aal1" | "aal2"; status?: string; invitationStatus?: string } = {}) {
  const level = options.level ?? "aal2";
  createClient.mockResolvedValue({ auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: {
      id: "user-1", email: "worker@example.com",
    } }, error: null }),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
      data: { currentLevel: level, nextLevel: "aal2", currentAuthenticationMethods: [
        { method: "totp", timestamp: Math.floor(Date.now() / 1000) },
      ] }, error: null,
    }) },
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
  return { rpc };
}

describe("staff invitation acceptance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a first-factor session before using service role", async () => {
    setup({ level: "aal1" });
    expect((await POST()).status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a profile that is already active", async () => {
    const { rpc } = setup({ status: "active" });
    expect((await POST()).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("activates only the authenticated invited user through the service-only function", async () => {
    const { rpc } = setup();
    expect((await POST()).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("accept_staff_invitation", { p_user_id: "user-1" });
  });
});
