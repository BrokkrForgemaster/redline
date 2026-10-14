"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  saveActiveRun,
  loadActiveRunForWorkOrder,
  clearActiveRun,
  type StoredActiveRun,
} from "./activeRunStore";

export interface ActiveRunState {
  serviceRunId: string | null;
  status: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  submittedAt: string | null;
  beforeCount: number;
  afterCount: number;
  hydrated: boolean;
}

export interface UseActiveRunResult {
  run: ActiveRunState;
  updateRun: (patch: Partial<Omit<StoredActiveRun, "workOrderId" | "savedAt">>) => Promise<void>;
  clearRun: () => Promise<void>;
}

const EMPTY: ActiveRunState = {
  serviceRunId: null,
  status: null,
  startedAt: null,
  finishedAt: null,
  submittedAt: null,
  beforeCount: 0,
  afterCount: 0,
  hydrated: false,
};

export function useActiveRun(workOrderId: string): UseActiveRunResult {
  const [run, setRun] = useState<ActiveRunState>(EMPTY);
  const stateRef = useRef<ActiveRunState>(EMPTY);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const localRevision = useRef(0);

  // Step 1: load from IndexedDB immediately (instant, no spinner)
  useEffect(() => {
    let cancelled = false;
    loadActiveRunForWorkOrder(workOrderId)
      .then((stored) => {
        if (cancelled) return;
        if (stored) {
          if (localRevision.current > 0) return;
          const loaded = {
            serviceRunId: stored.serviceRunId,
            status: stored.status,
            startedAt: stored.startedAt,
            finishedAt: stored.finishedAt,
            submittedAt: stored.submittedAt,
            beforeCount: stored.beforeCount ?? 0,
            afterCount: stored.afterCount ?? 0,
            hydrated: false,
          };
          stateRef.current = loaded;
          setRun(loaded);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [workOrderId]);

  // Step 2: hydrate from server, then fetch media counts if a run is active
  useEffect(() => {
    interface ApiServiceRun {
      id: string;
      work_order_id: string;
      status: string;
      started_at: string | null;
      finished_at: string | null;
      submitted_at: string | null;
    }

    let cancelled = false;
    const revisionAtStart = localRevision.current;

    async function hydrate() {
      try {
        const r = await fetch(`/api/v1/service-runs/active?work_order_id=${workOrderId}`);
        if (cancelled) return;
        if (!r.ok) throw new Error(`Active work HTTP ${r.status}`);
        const json = await r.json();
        const runs: ApiServiceRun[] = json?.service_runs ?? [];
        if (runs.length === 0) {
          const prepared = await fetch(`/api/v1/work-orders/${workOrderId}/prepare`, { method: "POST" });
          if (!prepared.ok) throw new Error(`Prepare visit HTTP ${prepared.status}`);
          const preparedJson = await prepared.json();
          if (preparedJson?.service_run) runs.push({
            ...preparedJson.service_run,
            work_order_id: workOrderId,
          });
        }

        if (runs.length > 0) {
          const sr = runs[0];

          // Fetch photo counts in parallel with the run data
          let beforeCount = 0;
          let afterCount = 0;
          try {
            const mr = await fetch(`/api/v1/service-runs/${sr.id}/media`);
            if (!cancelled && mr.ok) {
              const mj = await mr.json();
              beforeCount = mj?.counts?.before ?? 0;
              afterCount = mj?.counts?.after ?? 0;
            }
          } catch {
            // offline — leave counts at 0; IndexedDB values already shown
          }

          if (cancelled) return;
          if (localRevision.current !== revisionAtStart) return;
          const confirmed = {
            serviceRunId: sr.id,
            status: sr.status,
            startedAt: sr.started_at,
            finishedAt: sr.finished_at,
            submittedAt: sr.submitted_at,
            beforeCount,
            afterCount,
            hydrated: true,
          };
          await saveActiveRun({
            serviceRunId: sr.id,
            workOrderId,
            status: sr.status,
            startedAt: sr.started_at,
            finishedAt: sr.finished_at,
            submittedAt: sr.submitted_at,
            beforeCount,
            afterCount,
          });
          if (cancelled || localRevision.current !== revisionAtStart) return;
          stateRef.current = confirmed;
          setRun(confirmed);
        } else {
          if (!cancelled) setRun((prev) => ({ ...prev, hydrated: true }));
        }
      } catch {
        // Offline — keep IndexedDB state, mark hydrated so UI can proceed
        if (!cancelled) setRun((prev) => ({ ...prev, hydrated: true }));
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, [workOrderId]);

  const updateRun = useCallback(
    async (patch: Partial<Omit<StoredActiveRun, "workOrderId" | "savedAt">>) => {
      const write = async () => {
        const prev = stateRef.current;
        const next: ActiveRunState = {
          ...prev,
          ...(patch.serviceRunId !== undefined ? { serviceRunId: patch.serviceRunId } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
          ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt } : {}),
          ...(patch.submittedAt !== undefined ? { submittedAt: patch.submittedAt } : {}),
          ...(patch.beforeCount !== undefined ? { beforeCount: patch.beforeCount } : {}),
          ...(patch.afterCount !== undefined ? { afterCount: patch.afterCount } : {}),
          hydrated: true,
        };

        if (next.serviceRunId) {
          await saveActiveRun({
            serviceRunId: next.serviceRunId,
            workOrderId,
            status: next.status ?? "in_progress",
            startedAt: next.startedAt,
            finishedAt: next.finishedAt ?? null,
            submittedAt: next.submittedAt ?? null,
            beforeCount: next.beforeCount,
            afterCount: next.afterCount,
          });
        }
        localRevision.current++;
        stateRef.current = next;
        setRun(next);
      };
      const pending = writeQueue.current.then(write, write);
      writeQueue.current = pending.catch(() => {});
      await pending;
    },
    [workOrderId]
  );

  const clearRun = useCallback(async () => {
    if (run.serviceRunId) {
      await clearActiveRun(run.serviceRunId);
    }
    localRevision.current++;
    stateRef.current = { ...EMPTY, hydrated: true };
    setRun(stateRef.current);
  }, [run.serviceRunId]);

  return { run, updateRun, clearRun };
}
