import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "./route";

describe("Auth callback", () => {
  const exchange = vi.fn();
  const verify = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { exchangeCodeForSession: exchange, verifyOtp: verify,
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) } });
  });

  it("sends a valid recovery callback to the website password page", async () => {
    exchange.mockResolvedValue({ error: null });
    const response = await GET(new NextRequest("https://portal.example/auth/callback?code=secret"));
    expect(response.headers.get("location")).toBe("https://portal.example/reset-password");
    expect(response.headers.get("location")).not.toContain("secret");
  });

  it("sends an accepted invitation to MFA before account activation", async () => {
    verify.mockResolvedValue({ error: null });
    const response = await GET(new NextRequest("https://portal.example/auth/callback?type=invite&token_hash=secret"));
    expect(verify).toHaveBeenCalledWith({ token_hash: "secret", type: "invite" });
    expect(response.headers.get("location"))
      .toBe("https://portal.example/auth/mfa/enroll?next=%2Fauth%2Finvitation%2Faccept");
  });

  it("fails expired and malformed callbacks without reflecting tokens", async () => {
    exchange.mockResolvedValue({ error: new Error("Expired") });
    const expired = await GET(new NextRequest("https://portal.example/auth/callback?code=secret"));
    const missing = await GET(new NextRequest("https://portal.example/auth/callback?next=https://evil.example"));
    expect(expired.headers.get("location")).toBe("https://portal.example/forgot-password?error=invalid_link");
    expect(missing.headers.get("location")).toBe("https://portal.example/forgot-password?error=invalid_link");
  });
});
