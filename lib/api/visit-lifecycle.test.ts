import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUser, requireServiceRunAccess, rpc } = vi.hoisted(() => ({
  requireApiUser: vi.fn(), requireServiceRunAccess: vi.fn(), rpc: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({ requireApiUser }));
vi.mock("@/lib/api/service-access", () => ({ requireServiceRunAccess }));

import { applyVisitLifecycle } from "./visit-lifecycle";

const runId = "95f0714b-04b7-4477-a352-4829d58fa42b";
const orderId = "32c0f095-f9ef-44fd-b04f-ec3823f157cd";
const key = "4ee4bef1-95b6-46da-969f-c656b7b056d7";
const location = {
  latitude: 38.2, longitude: -85.7, accuracy_meters: 15,
  captured_at_device: "2026-10-12T18:00:00.000Z",
};
const request = (body: unknown) => new Request("http://localhost/api", {
  method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key },
  body: JSON.stringify(body),
});

describe("visit lifecycle API boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ ok: true, supabase: { rpc }, user: { id: "7faf9c16-c87b-4da3-bcee-40361b0d14c9" } });
    requireServiceRunAccess.mockResolvedValue({ ok: true, serviceRun: { work_order_id: orderId } });
    rpc.mockResolvedValue({ data: { service_run: { id: runId, status: "completed" } }, error: null });
  });

  it("rejects an attempted self-approved location override before any write", async () => {
    const response = await applyVisitLifecycle(request({ service_run_id: runId, location, override_reason: "please" }), orderId, "start");
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("derives the finish parent from the authorized visit", async () => {
    const response = await applyVisitLifecycle(request({ location }), runId, "finish");
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_visit_start_finish", expect.objectContaining({
      p_run_id: runId, p_work_order_id: orderId, p_action: "finish", p_key: key,
    }));
  });

  it("returns a conflict when the database finds changed idempotency input", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "changed" } });
    const response = await applyVisitLifecycle(request({ service_run_id: runId, location }), orderId, "start");
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("CONFLICT_FINALIZED_RECORD");
  });
});
