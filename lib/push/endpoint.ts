import { z } from "zod";
import { isIP } from "node:net";

const knownHosts = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
        (url.port && url.port !== "443") || url.hash || value.length > 2048) return false;
    if (isIP(url.hostname) || url.hostname === "localhost" ||
        url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local") ||
        url.hostname.endsWith(".internal")) return false;
    const configured = (process.env.PUSH_ENDPOINT_HOSTS ?? "").split(",")
      .map(host => host.trim().toLowerCase()).filter(Boolean);
    return knownHosts.has(url.hostname) || configured.includes(url.hostname);
  } catch {
    return false;
  }
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().refine(isAllowedPushEndpoint, "Unsupported push service endpoint."),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{40,256}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{16,256}$/),
  }),
});
