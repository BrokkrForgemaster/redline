export const SERVICE_STATES = [
  "draft",
  "scheduled",
  "assigned",
  "ready",
  "in_progress",
  "paused",
  "submitted",
  "needs_review",
  "completed",
  "rejected",
  "cancelled",
] as const;

export type ServiceState = (typeof SERVICE_STATES)[number];

export const SERVICE_TRANSITIONS = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["assigned", "cancelled"],
  assigned: ["ready", "cancelled"],
  ready: ["in_progress", "cancelled"],
  in_progress: ["paused", "submitted", "cancelled"],
  paused: ["in_progress", "cancelled"],
  submitted: ["needs_review", "completed", "rejected"],
  needs_review: ["completed", "rejected"],
  completed: [],
  rejected: ["ready", "cancelled"],
  cancelled: [],
} satisfies Record<ServiceState, ServiceState[]>;

export function canTransitionServiceState(from: ServiceState, to: ServiceState) {
  return (SERVICE_TRANSITIONS[from] as readonly ServiceState[]).includes(to);
}

export function assertServiceStateTransition(from: ServiceState, to: ServiceState) {
  if (!canTransitionServiceState(from, to)) {
    return {
      ok: false as const,
      code: "INVALID_STATE_TRANSITION",
      message: `Cannot transition service from ${from} to ${to}.`,
    };
  }

  return { ok: true as const };
}
