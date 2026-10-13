import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({ rpc }) }));

import { POST } from "./route";

const submissionId = "c883bd16-0424-4eea-abed-6aff788c7c5d";
const valid = {
  submissionId,
  name: "Alex Customer",
  email: "alex@example.com",
  phone: "",
  service: "Lawn Mowing",
  message: "Please quote our property service.",
  companyWebsite: "",
};
const request = (body: unknown) => new Request("http://localhost/api/contact", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

describe("public quote persistence boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INQUIRY_RATE_SECRET = "test-secret-with-at-least-thirty-two-characters";
    rpc.mockResolvedValue({ data: [{ lead_id: "06be967d-dbc3-4eaf-977a-e73f1a599472", delivery_state: "pending" }], error: null });
  });

  it("rejects malformed content and the spam honeypot before service-role writes", async () => {
    expect((await POST(request({ ...valid, email: "not-email" }))).status).toBe(400);
    expect((await POST(request({ ...valid, companyWebsite: "spam.example" }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts a saved inquiry while accurately reporting queued delivery", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, submissionId, delivery: "pending" });
    expect(rpc).toHaveBeenCalledWith("create_public_quote_inquiry", expect.objectContaining({
      p_submission_id: submissionId,
      p_email: "alex@example.com",
      p_service: "Lawn Mowing",
    }));
  });

  it("does not confirm a request when persistence fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
    const response = await POST(request(valid));
    expect(response.status).toBe(503);
    expect((await response.json()).saved).toBeUndefined();
  });
});
