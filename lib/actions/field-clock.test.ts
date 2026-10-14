import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, adminClient, canWorkLegacyJob, hasMfaAssurance, userFrom, adminFrom } = vi.hoisted(() => ({
  createClient: vi.fn(), adminClient: vi.fn(), canWorkLegacyJob: vi.fn(), hasMfaAssurance: vi.fn(),
  userFrom: vi.fn(), adminFrom: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient: adminClient }));
vi.mock("@/lib/api/legacy-job-access", () => ({ canWorkLegacyJob }));
vi.mock("@/lib/api/auth", () => ({ hasMfaAssurance }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { clockIn, clockOut } from "./field";

const userId = "fc3a9b45-1592-471c-a502-7bf125c37622";
const jobId = "7faf9c16-c87b-4da3-bcee-40361b0d14c9";
const entryId = "13778203-1b79-475b-a748-cc5416d890ae";

function countQuery(count: number) {
  const query = {
    eq: vi.fn(),
    then: (resolve: (value: unknown) => void) => resolve({ count, error: null }),
  };
  query.eq.mockReturnValue(query);
  // Supabase thenables resolve when awaited after the last filter.
  return { select: () => query };
}

describe("job clock is independent of the personal workday", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: userId } } }) }, from: userFrom });
    adminClient.mockReturnValue({ from: adminFrom });
    canWorkLegacyJob.mockResolvedValue(true);
    hasMfaAssurance.mockResolvedValue(true);
  });

  it("starts a job entry while a workday remains open and checks only open job entries", async () => {
    adminFrom.mockImplementation((table: string) => countQuery(table === "job_photos" ? 3 : 1));
    const not = vi.fn(() => ({ is: () => ({ limit: async () => ({ data: [], error: null }) }) }));
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: entryId }, error: null }) }) }));
    userFrom.mockReturnValue({ select: () => ({ eq: () => ({ not }) }), insert });
    expect(await clockIn(jobId)).toEqual({ entryId });
    expect(not).toHaveBeenCalledWith("job_id", "is", null);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ employee_id: userId, job_id: jobId }));
  });

  it("rejects job clock-in when the required site evidence is missing", async () => {
    adminFrom.mockImplementation((table: string) => countQuery(table === "job_photos" ? 2 : 1));
    expect(await clockIn(jobId)).toHaveProperty("error");
    expect(userFrom).not.toHaveBeenCalled();
  });

  it("rejects clock-out for a personal workday entry or another job", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn();
    const chain = { eq, is: () => ({ maybeSingle }) };
    eq.mockReturnValue(chain);
    adminFrom.mockImplementation((table: string) => table === "profiles"
      ? { select: () => ({ eq: () => ({ single: async () => ({ data: { status: "active" }, error: null }) }) }) }
      : { select: () => chain });
    expect(await clockOut(entryId, jobId)).toHaveProperty("error", "Clock entry does not belong to this job and worker.");
    expect(eq).toHaveBeenCalledWith("job_id", jobId);
    expect(adminFrom).not.toHaveBeenCalledWith("job_photos");
  });
});
