// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EnrollMfaPage from "./page";

const { createClient, listFactors, unenroll, enroll, getUser, assurance } = vi.hoisted(() => ({
  createClient: vi.fn(),
  listFactors: vi.fn(),
  unenroll: vi.fn(),
  enroll: vi.fn(),
  getUser: vi.fn(),
  assurance: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("next=%2Fdashboard"),
}));
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockReturnValue({ auth: { getUser, mfa: {
    listFactors, unenroll, enroll, getAuthenticatorAssuranceLevel: assurance,
  } } });
  getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  unenroll.mockResolvedValue({ error: null });
  enroll.mockResolvedValue({ data: { id: "new-factor", totp: {
    qr_code: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E", secret: "new-secret",
  } }, error: null });
});

test("an incomplete factor is not silently replaced; explicit restart removes it before a new enrollment", async () => {
  listFactors.mockResolvedValue({ data: { all: [
    { id: "unfinished", factor_type: "totp", status: "unverified" },
  ], totp: [] }, error: null });
  render(<EnrollMfaPage />);
  const restart = await screen.findByRole("button", { name: "Restart setup" });
  expect(enroll).not.toHaveBeenCalled();
  expect(unenroll).not.toHaveBeenCalled();
  fireEvent.click(restart);
  await screen.findByRole("button", { name: "Verify and enable" });
  expect(unenroll).toHaveBeenCalledWith({ factorId: "unfinished" });
  expect(enroll).toHaveBeenCalledWith({
    factorType: "totp",
    issuer: "https://www.redlinelandscapingky.com",
  });
  expect(unenroll.mock.invocationCallOrder[0]).toBeLessThan(enroll.mock.invocationCallOrder[0]);
});

test("failed removal preserves the incomplete factor and does not start another enrollment", async () => {
  listFactors.mockResolvedValue({ data: { all: [
    { id: "unfinished", factor_type: "totp", status: "unverified" },
  ], totp: [] }, error: null });
  unenroll.mockResolvedValue({ error: { code: "temporary_failure" } });
  render(<EnrollMfaPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Restart setup" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Could not restart"));
  expect(enroll).not.toHaveBeenCalled();
});
