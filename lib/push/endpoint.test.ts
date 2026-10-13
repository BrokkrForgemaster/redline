import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint, pushSubscriptionSchema } from "./endpoint";

describe("push endpoint egress boundary", () => {
  it("accepts known HTTPS push providers", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/example")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
  });

  it("rejects internal and arbitrary destinations before server delivery", () => {
    process.env.PUSH_ENDPOINT_HOSTS = "127.0.0.1,metadata.google.internal";
    for (const endpoint of [
      "http://127.0.0.1/push",
      "https://127.0.0.1/push",
      "https://fcm.googleapis.com.evil.example/send",
      "https://user:pass@fcm.googleapis.com/send",
      "https://fcm.googleapis.com:8443/send",
      "https://metadata.google.internal/push",
    ]) expect(isAllowedPushEndpoint(endpoint)).toBe(false);
    delete process.env.PUSH_ENDPOINT_HOSTS;
  });

  it("requires encryption keys", () => {
    expect(pushSubscriptionSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/example",
      keys: { p256dh: "short", auth: "short" },
    }).success).toBe(false);
  });
});
