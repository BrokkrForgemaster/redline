"use client";

import { useCallback, useEffect, useState } from "react";
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

  // Step 1: load from IndexedDB immediately (instant, no spinner)
  useEffect(() => {
    let cancelled = false;
    loadActiveRunForWorkOrder(workOrderId)
      .then((stored) => {
        if (cancelled) return;
        if (stored) {
          setRun({
            serviceRunId: stored.serviceRunId,
            status: stored.status,
            startedAt: stored.startedAt,
            finishedAt: stored.finishedAt,
            submittedAt: stored.submittedAt,
            beforeCount: stored.beforeCount ?? 0,
            afterCount: stored.afterCount ?? 0,
            hydrated: false,
          });
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
      started_at: string;
      finished_at: string | null;
      submitted_at: string | null;
    }

    let cancelled = false;

    async function hydrate() {
      try {
        const r = await fetch(`/api/v1/service-runs/active?work_order_id=${workOrderId}`);
        if (cancelled) return;
        const json = await r.json();
        const runs: ApiServiceRun[] = json?.service_runs ?? [];

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
          setRun({
            serviceRunId: sr.id,
            status: sr.status,
            startedAt: sr.started_at,
            finishedAt: sr.finished_at,
            submittedAt: sr.submitted_at,
            beforeCount,
            afterCount,
            hydrated: true,
          });
          saveActiveRun({
            serviceRunId: sr.id,
            workOrderId,
            status: sr.status,
            startedAt: sr.started_at,
            finishedAt: sr.finished_at,
            submittedAt: sr.submitted_at,
            beforeCount,
            afterCount,
          }).catch(() => {});
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
      setRun((prev) => {
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
          saveActiveRun({
            serviceRunId: next.serviceRunId,
            workOrderId,
            status: next.status ?? "in_progress",
            startedAt: next.startedAt ?? new Date().toISOString(),
            finishedAt: next.finishedAt ?? null,
            submittedAt: next.submittedAt ?? null,
            beforeCount: next.beforeCount,
            afterCount: next.afterCount,
          }).catch(() => {});
        }

        return next;
      });
    },
    [workOrderId]
  );

  const clearRun = useCallback(async () => {
    if (run.serviceRunId) {
      await clearActiveRun(run.serviceRunId).catch(() => {});
    }
    setRun({ ...EMPTY, hydrated: true });
  }, [run.serviceRunId]);

  return { run, updateRun, clearRun };
}
