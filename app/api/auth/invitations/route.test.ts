import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { requireStaffUser, createAdminClient } = vi.hoisted(() => ({
  requireStaffUser: vi.fn(), createAdminClient: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({ requireStaffUser }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));

import { POST } from "./route";

const input = { email: "worker@example.com", firstName: "Alex", lastName: "Crew",
  role: "mowing_crew_laborer" };
const request = (body: object = input) => new NextRequest("https://www.redlinelandscapingky.com/api/auth/invitations", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

function authorized(level: "aal1" | "aal2" = "aal2") {
  const create = vi.fn().mockResolvedValue({ data: "invitation-1", error: null });
  requireStaffUser.mockResolvedValue({ ok: true, supabase: {
    auth: { mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
      data: { currentLevel: level, nextLevel: "aal2", currentAuthenticationMethods: [
        { method: "totp", timestamp: Math.floor(Date.now() / 1000) },
      ] }, error: null,
    }) } }, rpc: create,
  } });
  const invite = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  const eq = vi.fn();
  const query = { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: { id: "invitation-1", status: "invited" }, error: null }),
    select: vi.fn() };
  query.select.mockReturnValue(query);
  eq.mockReturnValue({ ...query, eq });
  const from = vi.fn().mockReturnValue({
    select: () => ({ eq }),
    update: () => ({ eq }),
  });
  createAdminClient.mockReturnValue({ from, auth: { admin: { inviteUserByEmail: invite } } });
  return { create, invite, from };
}

describe("website staff invitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("REDLINE_PORTAL_URL", "https://www.redlinelandscapingky.com");
  });

  it("denies non-owner access before provider delivery", async () => {
    requireStaffUser.mockResolvedValue({ ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await POST(request())).status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("denies a first-factor-only owner", async () => {
    const { invite } = authorized("aal1");
    expect((await POST(request())).status).toBe(403);
    expect(invite).not.toHaveBeenCalled();
  });

  it("rejects any self-selected owner or developer role", async () => {
    const { invite } = authorized();
    expect((await POST(request({ ...input, role: "owner" }))).status).toBe(400);
    expect((await POST(request({ ...input, role: "developer" }))).status).toBe(400);
    expect(invite).not.toHaveBeenCalled();
  });

  it("persists owner intent before sending an invitation without role metadata", async () => {
    const { create, invite } = authorized();
    expect((await POST(request())).status).toBe(201);
    expect(create).toHaveBeenCalledWith("create_staff_invitation", expect.objectContaining({
      p_role: "mowing_crew_laborer", p_email: "worker@example.com",
    }));
    expect(invite).toHaveBeenCalledWith("worker@example.com", {
      redirectTo: "https://www.redlinelandscapingky.com/auth/callback?type=invite",
    });
    expect(create).toHaveBeenCalledBefore(invite);
  });
});
