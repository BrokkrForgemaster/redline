import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient, serverAdminClient, adminFrom, storage } = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), serverAdminClient: vi.fn(), adminFrom: vi.fn(), storage: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient, createAdminClient: serverAdminClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { clockIn, clockOut, tagJobLocation, uploadJobPhoto } from "./field";

const jobId = "7faf9c16-c87b-4da3-bcee-40361b0d14c9";
const userId = "fc3a9b45-1592-471c-a502-7bf125c37622";

describe("legacy field service-role boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) } });
    createAdminClient.mockReturnValue({ from: adminFrom, storage });
    serverAdminClient.mockReturnValue({ from: adminFrom, storage });
    const single = vi.fn().mockResolvedValue({ data: { role: "developer", status: "active" }, error: null });
    adminFrom.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });
  });

  it("rejects technical support before any legacy privileged work", async () => {
    expect(await clockIn(jobId)).toHaveProperty("error", "Active assignment required.");
    expect(await clockOut(jobId, jobId)).toHaveProperty("error", "Active assignment required.");
    expect(await tagJobLocation(new FormData(), jobId)).toHaveProperty("error", "Active assignment required.");
    expect(await uploadJobPhoto(new FormData(), jobId, "before")).toHaveProperty("error", "Active assignment required.");
    expect(storage).not.toHaveBeenCalled();
    expect(adminFrom).toHaveBeenCalledTimes(4);
  });

  it("rejects an inactive worker even when a browser still has a session", async () => {
    const single = vi.fn().mockResolvedValue({ data: { role: "mowing_crew_laborer", status: "inactive" } });
    adminFrom.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });
    expect(await clockIn(jobId)).toHaveProperty("error", "Active assignment required.");
    expect(storage).not.toHaveBeenCalled();
    expect(adminFrom).toHaveBeenCalledWith("profiles");
    expect(adminFrom).not.toHaveBeenCalledWith("jobs");
  });

  it("rejects a current worker whose job assignment was removed", async () => {
    adminFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: () => ({ eq: () => ({ single: async () => ({ data: { role: "mowing_crew_laborer", status: "active" } }) }) }) };
      if (table === "jobs") return { select: () => ({ eq: () => ({ single: async () => ({ data: { id: jobId, crew_id: null } }) }) }) };
      return { select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }) }) };
    });
    expect(await uploadJobPhoto(new FormData(), jobId, "before")).toHaveProperty("error", "Active assignment required.");
    expect(storage).not.toHaveBeenCalled();
  });
});
