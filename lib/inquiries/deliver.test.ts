import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, single } = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    rpc,
    from: () => {
      const query = { select: () => query, eq: () => query, single };
      return query;
    },
  }),
}));

import { deliverInquiryBatch, validatedInquiryDeliveryUrl } from "./deliver";

describe("quote delivery recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INQUIRY_DELIVERY_ENDPOINT = "https://formsubmit.co/ajax/stagingrecipient";
    rpc.mockImplementation((name: string) => Promise.resolve(name === "claim_inquiry_delivery_jobs"
      ? { data: [{ id: "job", lead_id: "lead", lease_token: "lease" }], error: null }
      : { data: true, error: null }));
    single.mockResolvedValue({ data: {
      id: "lead", source: "website_quote", first_name: "Alex", last_name: "Customer",
      email: "alex@example.com", phone: null, requested_services: ["Lawn Mowing"],
      notes: "Please quote the property.", public_submission_id: "submission",
    }, error: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rejects internal or arbitrary delivery endpoints", () => {
    expect(validatedInquiryDeliveryUrl("https://127.0.0.1/ajax/test")).toBeNull();
    expect(validatedInquiryDeliveryUrl("https://formsubmit.co.evil.example/ajax/test")).toBeNull();
    expect(validatedInquiryDeliveryUrl("https://formsubmit.co/ajax/stagingrecipient")).not.toBeNull();
  });

  it("keeps an inquiry queued when the provider is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const result = await deliverInquiryBatch();
    expect(result).toEqual({ claimed: 1, accepted: 0, retry: 1 });
    expect(rpc).toHaveBeenCalledWith("finish_inquiry_delivery_job", expect.objectContaining({ p_state: "retry" }));
  });
});
