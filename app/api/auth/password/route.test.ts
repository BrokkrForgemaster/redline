import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "./route";

function setup(level: "aal1" | "aal2", status = "active") {
  const updateUser = vi.fn().mockResolvedValue({ error: null });
  createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
        data: { currentLevel: level, nextLevel: "aal2",
          currentAuthenticationMethods: [{ method: "totp", timestamp: Math.floor(Date.now() / 1000) }] },
        error: null,
      }) },
      updateUser,
    },
    from: vi.fn().mockReturnValue({ select: () => ({ eq: () => ({
      single: vi.fn().mockResolvedValue({ data: { status }, error: null }),
    }) }) }),
  });
  return updateUser;
}

function request(body: object) {
  return new NextRequest("http://localhost/api/auth/password", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("website password endpoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks first-factor-only sessions before touching Auth", async () => {
    const updateUser = setup("aal1");
    const result = await POST(request({ mode: "reset", password: "A-Very-Strong-Password-2026" }));
    expect(result.status).toBe(403);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("allows an invited account after recent MFA and validates current password for a change", async () => {
    const updateUser = setup("aal2", "invited");
    const result = await POST(request({ mode: "change", password: "A-Very-Strong-Password-2026",
      currentPassword: "old-password" }));
    expect(result.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ password: "A-Very-Strong-Password-2026",
      current_password: "old-password" });
  });

  it("rejects inactive users and malformed passwords", async () => {
    const updateUser = setup("aal2", "inactive");
    expect((await POST(request({ mode: "reset", password: "A-Very-Strong-Password-2026" }))).status).toBe(403);
    expect((await POST(request({ mode: "reset", password: "short" }))).status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
