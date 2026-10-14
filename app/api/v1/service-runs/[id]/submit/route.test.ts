import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUser, requireServiceRunAccess } = vi.hoisted(() => ({
  requireApiUser: vi.fn(), requireServiceRunAccess: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({ requireApiUser }));
vi.mock("@/lib/api/service-access", () => ({ requireServiceRunAccess }));

import { POST } from "./route";

const id = "95f0714b-04b7-4477-a352-4829d58fa42b";
const call = () => POST(new Request("http://localhost/api", { method: "POST" }),
  { params: Promise.resolve({ id }) });

describe("legacy submit compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ ok: true, supabase: {}, user: { id: "u" } });
  });

  it("acknowledges a completed visit without mutating its project", async () => {
    requireServiceRunAccess.mockResolvedValue({ ok: true, serviceRun: {
      id, status: "completed", finished_at: "2026-10-12T18:00:00Z",
    } });
    const response = await call();
    expect(response.status).toBe(200);
    expect((await response.json()).service_run.status).toBe("completed");
    expect(requireServiceRunAccess).toHaveBeenCalledOnce();
  });

  it("does not clear a submit intent for work that was not finished", async () => {
    requireServiceRunAccess.mockResolvedValue({ ok: true, serviceRun: {
      id, status: "in_progress", finished_at: null,
    } });
    expect((await call()).status).toBe(409);
  });
});
