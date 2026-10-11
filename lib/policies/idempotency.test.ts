import { describe, expect, it } from "vitest";
import { isValidIdempotencyKey, requireIdempotencyKey } from "./idempotency";

describe("idempotency key policy", () => {
  it("accepts UUID v4 keys", () => {
    expect(isValidIdempotencyKey("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
  });

  it("rejects missing or malformed keys", () => {
    expect(requireIdempotencyKey(undefined)).toMatchObject({
      ok: false,
      code: "IDEMPOTENCY_KEY_REQUIRED",
    });
    expect(isValidIdempotencyKey("not-a-uuid")).toBe(false);
  });
});
