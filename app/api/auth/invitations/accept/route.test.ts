import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("retired invitation acceptance", () => {
  it("cannot activate an account through the old path", async () => {
    const response = await POST();
    expect(response.status).toBe(410);
  });
});
