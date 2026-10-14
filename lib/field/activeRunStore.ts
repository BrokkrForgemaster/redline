import { openFieldDb, idbPut, idbDelete, idbGetAll } from "./db";
import { createClient } from "@/lib/supabase/client";

export interface StoredActiveRun {
  ownerUserId?: string;
  serviceRunId: string;
  workOrderId: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  submittedAt: string | null;
  beforeCount: number;
  afterCount: number;
  savedAt: string;
}

export async function saveActiveRun(
  run: Omit<StoredActiveRun, "savedAt" | "ownerUserId">
): Promise<void> {
  const { data: { session } } = await createClient().auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("Sign in to save active work.");
  const db = await openFieldDb();
  await idbPut(db, "activeRuns", {
    ...run,
    ownerUserId: user.id,
    savedAt: new Date().toISOString(),
  });
}

export async function loadActiveRunForWorkOrder(
  workOrderId: string
): Promise<StoredActiveRun | null> {
  const { data: { session } } = await createClient().auth.getSession();
  const user = session?.user;
  if (!user) return null;
  const db = await openFieldDb();
  const all = await idbGetAll<StoredActiveRun>(db, "activeRuns");
  return (
    all.find(
      (r) =>
        r.ownerUserId === user.id &&
        r.workOrderId === workOrderId &&
        !["submitted", "completed", "cancelled"].includes(r.status)
    ) ?? null
  );
}

export async function clearActiveRun(serviceRunId: string): Promise<void> {
  const db = await openFieldDb();
  await idbDelete(db, "activeRuns", serviceRunId);
}
