import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStaffUser, rpc } = vi.hoisted(() => ({
  requireStaffUser: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/api/auth", () => ({ requireStaffUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createCrew, updateCrew, addCrewMember } from "./crews";

const crewId = "7faf9c16-c87b-4da3-bcee-40361b0d14c9";
const workerId = "1dcf5188-cf70-47e9-b2f7-05dfb427a6fa";

describe("crew action boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffUser.mockResolvedValue({ ok: true, supabase: { rpc } });
    rpc.mockResolvedValue({ data: crewId, error: null });
  });

  it("rejects a non-owner before calling the privileged crew command", async () => {
    requireStaffUser.mockResolvedValue({ ok: false });
    expect(await addCrewMember(crewId, workerId, "member")).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("preserves omitted update fields and passes explicit clearing", async () => {
    await updateCrew(crewId, { name: "North crew" });
    expect(rpc).toHaveBeenCalledWith("apply_crew_change", {
      p_action: "update", p_crew_id: crewId, p_payload: { name: "North crew" },
    });
    await updateCrew(crewId, { leader_id: null, description: "" });
    expect(rpc).toHaveBeenLastCalledWith("apply_crew_change", {
      p_action: "update", p_crew_id: crewId, p_payload: { leader_id: null, description: "" },
    });
  });

  it("does not claim creation when the database command fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514" } });
    const result = await createCrew({ name: "North crew", leader_id: workerId });
    expect(result).toEqual({ error: "Crew leader and membership are inconsistent" });
  });
});
