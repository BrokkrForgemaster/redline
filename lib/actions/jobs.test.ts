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

  it("uses the guarded database status command", async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await updateJobStatus(id, "scheduled")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("change_legacy_job_status", {
      p_job_id: id, p_status: "scheduled",
    });
    expect(from).not.toHaveBeenCalled();
  });
});
