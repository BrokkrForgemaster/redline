import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient } = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient, createAdminClient }));

import { requireApiUser, requireStaffUser } from "./auth";

const id = "ad352ad3-3e57-4181-b6e4-84f8278bbeba";

function session(status: string, role: string, currentLevel: string, nextLevel = currentLevel) {
  const assurance = vi.fn().mockResolvedValue({ data: { currentLevel, nextLevel }, error: null });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id } }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: assurance },
    },
    from: vi.fn().mockReturnValue({ select: () => ({ eq: () => ({
      single: vi.fn().mockResolvedValue({ data: { id, status, role }, error: null }),
    }) }) }),
  };
  createClient.mockResolvedValue(client);
  return { client, assurance };
}

describe("protected account and MFA boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an active first-factor-only API caller", async () => {
    session("active", "mowing_crew_laborer", "aal1", "aal2");
    const result = await requireApiUser();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(await result.response.json()).toMatchObject({ code: "MFA_REQUIRED" });
    }
  });

  it("rejects an inactive account even with MFA", async () => {
    const { assurance } = session("inactive", "owner", "aal2");
    const result = await requireApiUser();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(await result.response.json()).toMatchObject({ code: "ACCOUNT_INACTIVE" });
    expect(assurance).not.toHaveBeenCalled();
  });

  it("accepts current AAL2 and rejects a stale AAL2 token after factor removal", async () => {
    session("active", "mowing_crew_laborer", "aal2", "aal2");
    expect((await requireApiUser()).ok).toBe(true);
    session("active", "mowing_crew_laborer", "aal2", "aal1");
    expect((await requireApiUser()).ok).toBe(false);
  });

  it("requires MFA for a staff action regardless of role", async () => {
    session("active", "mowing_crew_lead", "aal1", "aal2");
    const result = await requireStaffUser();
    expect(result.ok).toBe(false);
  });
});
