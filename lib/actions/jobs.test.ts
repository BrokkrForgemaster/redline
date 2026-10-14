import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStaffUser, from, rpc, logAudit } = vi.hoisted(() => ({
  requireStaffUser: vi.fn(), from: vi.fn(), rpc: vi.fn(), logAudit: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({ requireStaffUser }));
vi.mock("./audit", () => ({ logAudit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateJob, updateJobStatus } from "./jobs";

const id = "7faf9c16-c87b-4da3-bcee-40361b0d14c9";
const input = {
  customerId: id,
  serviceType: "mowing",
  title: "Lawn visit",
  priority: "normal" as const,
  isRecurring: false,
};

describe("legacy job owner boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffUser.mockResolvedValue({
      ok: true, supabase: { from, rpc }, user: { id },
    });
  });

  it("rejects business writes without active owner MFA", async () => {
    requireStaffUser.mockResolvedValue({ ok: false });
    expect(await updateJob(id, input)).toHaveProperty("error");
    expect(await updateJobStatus(id, "scheduled")).toHaveProperty("error");
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks field lifecycle statuses before reaching the database", async () => {
    expect(await updateJobStatus(id, "completed")).toHaveProperty("error");
    expect(await updateJobStatus(id, "in_progress")).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports missing job updates instead of claiming success", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    from.mockReturnValue({ update: () => ({ eq: () => ({ select: () => ({ single }) }) }) });
    expect(await updateJob(id, input)).toHaveProperty("error");
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("persists an active crew assignment and reports a rejected save", async () => {
    const crewId = "e78a521b-c498-4321-87ac-2db662bcdb30";
    const update = vi.fn();
    const single = vi.fn().mockResolvedValueOnce({ data: { id }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    update.mockReturnValue({ eq: () => ({ select: () => ({ single }) }) });
    from.mockImplementation((table: string) => table === "crews"
      ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: crewId }, error: null }) }) }) }) }
      : { update });

    expect(await updateJob(id, { ...input, crewId })).toEqual({ id });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ crew_id: crewId }));
    expect(await updateJob(id, { ...input, crewId })).toHaveProperty("error");
  });

  it("rejects an inactive or missing crew before changing a job", async () => {
    const crewId = "e78a521b-c498-4321-87ac-2db662bcdb30";
    from.mockReturnValue({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) });
    expect(await updateJob(id, { ...input, crewId })).toHaveProperty("error");
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("uses the guarded database status command", async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await updateJobStatus(id, "scheduled")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("change_legacy_job_status", {
      p_job_id: id, p_status: "scheduled",
    });
    expect(from).not.toHaveBeenCalled();
  });
});
