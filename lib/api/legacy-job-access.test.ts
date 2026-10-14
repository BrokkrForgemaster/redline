import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, from } = vi.hoisted(() => ({
  createAdminClient: vi.fn(), from: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));

import { canWorkLegacyJob } from "./legacy-job-access";

const actor = "33bc4dcb-b47d-43f0-ac73-6fbf38c77b01";
const jobId = "57d6d4b4-31ea-4b9b-a6a1-879a42bba859";

function database(rows: Record<string, unknown>) {
  from.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      single: async () => ({ data: rows[table] ?? null, error: null }),
      limit: async () => ({ data: rows[table] ?? [], error: null }),
    };
    return query;
  });
}

describe("legacy job privileged scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdminClient.mockReturnValue({ from });
  });

  it("allows an active owner, but never a developer or inactive account", async () => {
    database({ profiles: { role: "owner", status: "active" }, jobs: { id: jobId, crew_id: null } });
    expect(await canWorkLegacyJob(actor, jobId)).toBe(true);
    database({ profiles: { role: "developer", status: "active" }, jobs: { id: jobId, crew_id: null } });
    expect(await canWorkLegacyJob(actor, jobId)).toBe(false);
    database({ profiles: { role: "mowing_crew_laborer", status: "inactive" }, jobs: { id: jobId, crew_id: null } });
    expect(await canWorkLegacyJob(actor, jobId)).toBe(false);
  });

  it("requires a current direct or active crew assignment", async () => {
    const base = { profiles: { role: "mowing_crew_laborer", status: "active" },
      jobs: { id: jobId, crew_id: "crew-1" }, job_assignments: [] };
    database({ ...base, crews: { active: true }, crew_members: [] });
    expect(await canWorkLegacyJob(actor, jobId)).toBe(false);
    database({ ...base, crews: { active: true }, crew_members: [{ id: "membership" }] });
    expect(await canWorkLegacyJob(actor, jobId)).toBe(true);
    database({ ...base, crews: { active: false }, crew_members: [{ id: "membership" }] });
    expect(await canWorkLegacyJob(actor, jobId)).toBe(false);
    database({ ...base, job_assignments: [{ id: "direct" }] });
    expect(await canWorkLegacyJob(actor, jobId)).toBe(true);
  });
});
