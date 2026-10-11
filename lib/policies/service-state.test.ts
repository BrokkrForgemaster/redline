import { describe, expect, it } from "vitest";
import { assertServiceStateTransition, canTransitionServiceState } from "./service-state";

describe("service state transitions", () => {
  it("allows expected field-service progression", () => {
    expect(canTransitionServiceState("ready", "in_progress")).toBe(true);
    expect(canTransitionServiceState("in_progress", "submitted")).toBe(true);
    expect(canTransitionServiceState("submitted", "completed")).toBe(true);
  });

  it("blocks arbitrary jumps into finalized states", () => {
    expect(assertServiceStateTransition("draft", "completed")).toMatchObject({
      ok: false,
      code: "INVALID_STATE_TRANSITION",
    });
  });

  it("treats completed and cancelled as terminal", () => {
    expect(canTransitionServiceState("completed", "ready")).toBe(false);
    expect(canTransitionServiceState("cancelled", "scheduled")).toBe(false);
  });
});
