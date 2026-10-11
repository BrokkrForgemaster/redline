const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_PATTERN.test(value);
}

export function requireIdempotencyKey(value: unknown) {
  if (!isValidIdempotencyKey(value)) {
    return {
      ok: false as const,
      code: "IDEMPOTENCY_KEY_REQUIRED",
      message: "A UUID v4 idempotency key is required for this write operation.",
    };
  }

  return { ok: true as const, key: value };
}
