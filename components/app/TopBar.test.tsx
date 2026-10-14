// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Profile } from "@/types/database";

const { createClient, updateResult } = vi.hoisted(() => ({
  createClient: vi.fn(),
  updateResult: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient }));
vi.mock("@/lib/utils/cn", () => ({ cn: (...values: string[]) => values.filter(Boolean).join(" ") }));
vi.mock("@/lib/auth/profile-display", () => ({
  getProfileDisplayName: () => "Owner User",
  getProfileInitials: () => "OU",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import TopBar from "./TopBar";

const alert = {
  id: "70fac445-e5db-463f-bff6-92191cd21877",
  title: "Crew assignment",
  body: "A visit changed",
  action_url: "/dashboard",
  created_at: "2026-10-12T18:00:00Z",
  read: false,
};
const profile = {
  id: "d27ff280-f140-4572-80f9-bc084532fe18",
  first_name: "Owner",
  last_name: "User",
  email: "owner@example.test",
  avatar_url: null,
} as Profile;

function makeClient(pollAlerts: typeof alert[] = []) {
  const unreadQuery = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [alert], count: 1, error: null }),
  };
  const latestQuery = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [{ id: alert.id, created_at: alert.created_at }], error: null }),
  };
  const pollQuery = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: pollAlerts, error: null }),
  };
  const updateQuery = {
    eq: vi.fn().mockReturnThis(),
    select: updateResult,
  };
  const table = {
    select: vi.fn((columns: string, options?: { count?: string }) =>
      options?.count ? unreadQuery : columns === "id, created_at" ? latestQuery : pollQuery),
    update: vi.fn(() => updateQuery),
  };
  let insertHandler: ((payload: { new: typeof alert }) => void) | undefined;
  const channel = {
    on: vi.fn((_event, _filter, callback) => { insertHandler = callback; return channel; }),
    subscribe: vi.fn().mockReturnThis(),
  };
  return { from: vi.fn(() => table), channel: vi.fn(() => channel), removeChannel: vi.fn(),
    auth: { signOut: vi.fn() }, emit: (item: typeof alert) => insertHandler?.({ new: item }) };
}

describe("header alert persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockReturnValue(makeClient());
    updateResult.mockResolvedValue({ data: null, error: { message: "offline" } });
  });
  afterEach(cleanup);

  it("keeps an alert visible when marking it read fails", async () => {
    render(<TopBar profile={profile} onMenuClick={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await screen.findByText("Crew assignment");
    fireEvent.click(screen.getByRole("button", { name: /Crew assignment/ }));
    await screen.findByRole("alert");
    expect(screen.getByText("Crew assignment")).toBeTruthy();
    expect(screen.getByText("1 active")).toBeTruthy();
  });

  it("keeps the unread count when mark-all persistence fails", async () => {
    render(<TopBar profile={profile} onMenuClick={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await screen.findByText("Crew assignment");
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("not marked read"));
    expect(screen.getByText("1 active")).toBeTruthy();
  });

  it("does not sound a new-alert tone merely because the inbox was opened", async () => {
    const oscillator = vi.fn();
    const resume = vi.fn().mockResolvedValue(undefined);
    const AudioContextMock = vi.fn(function () {
      return { state: "suspended", resume, createOscillator: oscillator };
    });
    vi.stubGlobal("AudioContext", AudioContextMock);
    try {
      render(<TopBar profile={profile} onMenuClick={() => {}} />);
      fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
      await screen.findByText("Crew assignment");
      expect(AudioContextMock).toHaveBeenCalledOnce();
      expect(resume).toHaveBeenCalledOnce();
      expect(oscillator).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sounds once for each new alert found by polling and ignores duplicate realtime delivery", async () => {
    const first = { ...alert, id: "70fac445-e5db-463f-bff6-92191cd21878", created_at: "2026-10-12T18:01:00Z" };
    const second = { ...alert, id: "70fac445-e5db-463f-bff6-92191cd21879", created_at: "2026-10-12T18:02:00Z" };
    const client = makeClient([first, second]);
    createClient.mockReturnValue(client);
    const start = vi.fn();
    const oscillator = { type: "sine", frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(), start, stop: vi.fn() };
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn() };
    vi.stubGlobal("AudioContext", vi.fn(function () {
      return { state: "running", currentTime: 0, destination: {},
        createOscillator: () => oscillator, createGain: () => gain };
    }));
    try {
      render(<TopBar profile={profile} onMenuClick={() => {}} />);
      await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
      client.emit(first);
      client.emit(second);
      expect(start).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
