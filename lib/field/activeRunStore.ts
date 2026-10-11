import { openFieldDb, idbPut, idbDelete, idbGetAll } from "./db";

export interface StoredActiveRun {
  serviceRunId: string;
  workOrderId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  submittedAt: string | null;
  beforeCount: number;
  afterCount: number;
  savedAt: string;
}

export async function saveActiveRun(
  run: Omit<StoredActiveRun, "savedAt">
): Promise<void> {
  const db = await openFieldDb();
  await idbPut(db, "activeRuns", {
    ...run,
    savedAt: new Date().toISOString(),
  });
}

export async function loadActiveRunForWorkOrder(
  workOrderId: string
): Promise<StoredActiveRun | null> {
  const db = await openFieldDb();
  const all = await idbGetAll<StoredActiveRun>(db, "activeRuns");
  return (
    all.find(
      (r) =>
        r.workOrderId === workOrderId &&
        !["submitted", "completed", "cancelled"].includes(r.status)
    ) ?? null
  );
}

export async function clearActiveRun(serviceRunId: string): Promise<void> {
  const db = await openFieldDb();
  await idbDelete(db, "activeRuns", serviceRunId);
}
