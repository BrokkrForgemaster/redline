export type SyncTrigger = "launch" | "focus" | "online" | "manual";

export type SyncTriggerCallback = (trigger: SyncTrigger) => void;

export function registerSyncTriggers(onTrigger: SyncTriggerCallback): () => void {
  const handlers: Array<{ target: EventTarget; type: string; fn: () => void }> = [];

  function add(target: EventTarget, type: string, trigger: SyncTrigger) {
    const fn = () => onTrigger(trigger);
    target.addEventListener(type, fn);
    handlers.push({ target, type, fn });
  }

  add(window, "focus", "focus");
  add(window, "online", "online");

  // Visibility change covers mobile browser backgrounding
  const visibilityFn = () => {
    if (document.visibilityState === "visible") onTrigger("focus");
  };
  document.addEventListener("visibilitychange", visibilityFn);

  return () => {
    for (const { target, type, fn } of handlers) {
      target.removeEventListener(type, fn);
    }
    document.removeEventListener("visibilitychange", visibilityFn);
  };
}

// Conflict rules from offline sync design:
//   - Server assignment, permissions, and finalized state always win
//   - Never overwrite completed or approved records with stale local state
//   - Append-safe new events where possible
//   - Ambiguous conflicts go to admin review
export function isTerminalServerStatus(status: string): boolean {
  return ["completed", "approved", "rejected", "cancelled"].includes(status);
}

export function shouldDiscardLocalMutation(
  localAction: string,
  serverStatus: string
): boolean {
  // Never push state-change mutations against a finalized record
  if (isTerminalServerStatus(serverStatus)) return true;

  // Submitted records can't be started or finished again
  if (
    serverStatus === "submitted" &&
    (localAction === "service-runs:start" || localAction === "service-runs:finish")
  )
    return true;

  return false;
}
