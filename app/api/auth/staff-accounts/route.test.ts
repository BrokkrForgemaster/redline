import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { requireStaffUser, createAdminClient } = vi.hoisted(() => ({
  requireStaffUser: vi.fn(), createAdminClient: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({ requireStaffUser }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));
import { POST } from "./route";

const input = { email: "worker@example.com", firstName: "Alex", lastName: "Crew",
  role: "subcontractor", initialPassword: "Temporary-Secret-123" };
const request = (body: object = input) => new NextRequest("https://portal.example/api/auth/staff-accounts", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

function setup(level: "aal1" | "aal2" = "aal2") {
  const register = vi.fn().mockResolvedValue({ error: null });
  requireStaffUser.mockResolvedValue({ ok: true, supabase: {
    auth: { mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
      data: { currentLevel: level, nextLevel: "aal2", currentAuthenticationMethods: [
        { method: "totp", timestamp: Math.floor(Date.now() / 1000) },
      ] }, error: null,
    }) } }, rpc: register,
  } });
  const createUser = vi.fn().mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
  createAdminClient.mockReturnValue({ auth: { admin: { createUser } } });
  return { register, createUser };
}

describe("owner-provisioned staff account", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects a non-owner before creating Auth identity", async () => {
    requireStaffUser.mockResolvedValue({ ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await POST(request())).status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
  it("rejects an owner without MFA", async () => {
    const { createUser } = setup("aal1");
    expect((await POST(request())).status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });
  it("does not allow owner or developer roles from input", async () => {
    const { createUser } = setup();
    expect((await POST(request({ ...input, role: "owner" }))).status).toBe(400);
    expect((await POST(request({ ...input, role: "developer" }))).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });
  it("creates an invited Auth identity without privileged metadata or email", async () => {
    const { register, createUser } = setup();
    expect((await POST(request())).status).toBe(201);
    expect(createUser).toHaveBeenCalledWith({ email: input.email,
      password: input.initialPassword, email_confirm: true });
    expect(register).toHaveBeenCalledWith("register_staff_account_setup", expect.objectContaining({
      p_user_id: "new-user", p_role: "subcontractor", p_email: input.email,
    }));
    expect(createUser).toHaveBeenCalledBefore(register);
  });
  it("reports registration failure without claiming operational access", async () => {
    const { register } = setup();
    register.mockResolvedValue({ error: { message: "failed" } });
    expect((await POST(request())).status).toBe(500);
  });
});
