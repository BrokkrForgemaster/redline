import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { requireStaffUser, createAdminClient } = vi.hoisted(() => ({
  requireStaffUser: vi.fn(), createAdminClient: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({ requireStaffUser }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));

import { POST } from "./route";

const id = "cba4a7df-d510-46e4-9bed-c68a9030ea92";
const userId = "75b1f3db-1c1c-40c5-b9db-b35ed5291346";
const request = () => new NextRequest(`http://localhost/api/auth/mfa/recovery/${id}/resolve`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identityMethod: "in_person", reviewNote: "Verified in person at the office." }),
});
const context = { params: Promise.resolve({ id }) };

function authorized(level: "aal1" | "aal2" = "aal2") {
  const begin = vi.fn().mockResolvedValue({ data: userId, error: null });
  requireStaffUser.mockResolvedValue({ ok: true, supabase: {
    auth: { mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
      data: { currentLevel: level, currentAuthenticationMethods: [
        { method: "totp", timestamp: Math.floor(Date.now() / 1000) },
      ] }, error: null,
    }) } },
    rpc: begin,
  } });
  const deleteFactor = vi.fn().mockResolvedValue({ error: null });
  const listFactors = vi.fn().mockResolvedValue({ data: { factors: [{ id: id, status: "verified" }] }, error: null });
  const complete = vi.fn().mockResolvedValue({ error: null });
  createAdminClient.mockReturnValue({
    auth: { admin: { mfa: { listFactors, deleteFactor } } },
    rpc: complete,
    from: () => ({ update: () => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }) }),
  });
  return { begin, deleteFactor, listFactors, complete };
}

describe("owner-assisted MFA recovery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies a non-owner before provider access", async () => {
    requireStaffUser.mockResolvedValue({ ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await POST(request(), context)).status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("requires recent MFA before recording an identity decision", async () => {
    const { begin } = authorized("aal1");
    expect((await POST(request(), context)).status).toBe(403);
    expect(begin).not.toHaveBeenCalled();
  });

  it("keeps provider failures retryable", async () => {
    const { listFactors, complete } = authorized();
    listFactors.mockResolvedValue({ data: null, error: new Error("Provider unavailable") });
    expect((await POST(request(), context)).status).toBe(502);
    expect(complete).not.toHaveBeenCalled();
  });

  it("removes factors only after audited approval and completes the request", async () => {
    const { begin, deleteFactor, complete } = authorized();
    expect((await POST(request(), context)).status).toBe(200);
    expect(begin).toHaveBeenCalledBefore(deleteFactor);
    expect(deleteFactor).toHaveBeenCalledWith({ userId, id });
    expect(complete).toHaveBeenCalledWith("complete_mfa_recovery", { p_request_id: id });
  });
});
