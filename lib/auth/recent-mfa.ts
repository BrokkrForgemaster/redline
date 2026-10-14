type AuthenticationMethod = string | { method: string; timestamp?: number };

export function hasRecentTotp(methods: AuthenticationMethod[] | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = 15 * 60) {
  return Boolean(methods?.some(entry =>
    typeof entry !== "string" && entry.method === "totp" &&
    typeof entry.timestamp === "number" &&
    entry.timestamp <= nowSeconds + 60 &&
    entry.timestamp >= nowSeconds - maxAgeSeconds));
}
