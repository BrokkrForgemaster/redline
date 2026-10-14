import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("retired email invitations", () => {
  it("does not create or send invitations", async () => {
    const response = await POST();
    expect(response.status).toBe(410);
  });
});
