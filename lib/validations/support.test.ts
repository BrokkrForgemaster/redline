import { describe, expect, it } from "vitest";
import { createSupportSchema, replySupportSchema } from "./support";

describe("support input privacy", () => {
  it("rejects obvious access credentials before persistence", () => {
    expect(createSupportSchema.safeParse({
      subject: "Login issue", category: "access", affectedPage: "/login",
      body: "password: secret-value",
    }).success).toBe(false);
    expect(replySupportSchema.safeParse({
      ticketId: "2d2f2a0b-43fb-4e4c-baf0-47fef92220d6",
      body: "Token sk_abcdefghijklmnopqrstuvwxyz012345",
    }).success).toBe(false);
  });

  it("accepts a bounded technical description", () => {
    expect(createSupportSchema.safeParse({
      subject: "Calendar refresh", category: "technical_issue", affectedPage: "/calendar",
      body: "The scheduled visit disappears after I reload the page.",
    }).success).toBe(true);
  });
});
