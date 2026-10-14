import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, sendNotification, records, upsert } = vi.hoisted(() => ({
  rpc: vi.fn(), sendNotification: vi.fn(), records: new Map<string, unknown>(), upsert: vi.fn(),
}));
vi.mock("web-push", () => ({ default: { sendNotification } }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    rpc,
    from: (table: string) => {
      const result = () => records.get(table) ?? { data: [], error: null };
      const query = {
        select: () => query, eq: () => query, in: () => query, limit: async () => result(),
        single: async () => result(), maybeSingle: async () => result(),
        update: () => query, upsert,
        then: (resolve: (value: unknown) => void) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  }),
}));

import { deliverWorkflowPushBatch } from "./deliver";

const job = {
  id: "c4b86ff4-bab8-4c69-9a7d-1da147cb03ad",
  recipient_id: "a28ea55d-c597-4094-b723-8c6681554a78",
  source_event_id: "4171bdfa-4ef9-47cc-8e48-48e5a8be2965",
  lease_token: "c9374875-4f34-45c5-803a-c419a3e2a505",
};

describe("server push delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    records.clear();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-test-key";
    process.env.VAPID_PRIVATE_KEY = "private-test-key";
    process.env.VAPID_SUBJECT = "mailto:staging@example.com";
    rpc.mockImplementation((name: string) => Promise.resolve(name === "claim_workflow_push_jobs"
      ? { data: [job], error: null } : { data: true, error: null }));
    upsert.mockResolvedValue({ error: null });
    sendNotification.mockResolvedValue({ statusCode: 201 });
  });

  it("disables a queued push for a revoked recipient before network delivery", async () => {
    records.set("profiles", { data: { role: "owner", status: "inactive" }, error: null });
    const result = await deliverWorkflowPushBatch();
    expect(result).toEqual({ claimed: 1, accepted: 0, retry: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("finish_workflow_push_job", expect.objectContaining({ p_state: "disabled" }));
  });

  it("records provider acceptance before completing an authorized job", async () => {
    records.set("profiles", { data: { role: "owner", status: "active" }, error: null });
    records.set("service_run_events", { data: { service_run_id: "run-1" }, error: null });
    records.set("service_runs", { data: { work_order_id: "order-1" }, error: null });
    records.set("push_preferences", { data: { push_enabled: true }, error: null });
    records.set("notifications", { data: { id: "inbox-1" }, error: null });
    records.set("push_subscriptions", { data: [{
      id: "sub-1", endpoint: "https://fcm.googleapis.com/fcm/send/test",
      p256dh: "A".repeat(50), auth_secret: "B".repeat(20),
    }], error: null });
    records.set("workflow_push_attempts", { data: [], error: null });
    const result = await deliverWorkflowPushBatch();
    expect(result.accepted).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ state: "accepted" }), expect.anything());
    expect(rpc).toHaveBeenCalledWith("finish_workflow_push_job", expect.objectContaining({ p_state: "delivered" }));
  });
});
