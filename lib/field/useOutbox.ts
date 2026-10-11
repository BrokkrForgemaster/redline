"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  drainOutbox,
  pendingMutationCount,
  enqueueMutation,
  drainPendingMedia,
  enqueuePendingMedia,
  pendingMediaItemCount,
} from "./outbox";
import { registerSyncTriggers } from "./sync";
import type { PendingMutation, PendingMedia } from "./db";

export interface OutboxState {
  pendingCount: number;
  pendingMediaCount: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface UseOutboxResult extends OutboxState {
  drain: () => Promise<void>;
  enqueue: (mutation: Omit<PendingMutation, "id" | "retry_count" | "last_error" | "next_retry_at">) => Promise<string>;
  enqueueMedia: (item: Omit<PendingMedia, "id" | "retry_count" | "last_error" | "next_retry_at">) => Promise<string>;
}

export function useOutbox(): UseOutboxResult {
  const [state, setState] = useState<OutboxState>({
    pendingCount: 0,
    pendingMediaCount: 0,
    syncing: false,
    lastSyncAt: null,
    lastError: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const drainingRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    try {
      const [count, mediaCount] = await Promise.all([
        pendingMutationCount(),
        pendingMediaItemCount(),
      ]);
      setState((prev) => ({ ...prev, pendingCount: count, pendingMediaCount: mediaCount }));
    } catch {
      // non-fatal
    }
  }, []);

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, syncing: true, lastError: null }));

    try {
      // Drain media first (priority 3) so photos are uploaded before submit (priority 5)
      const [mediaResult, mutResult] = await Promise.all([
        drainPendingMedia(controller.signal),
        drainOutbox(controller.signal),
      ]);

      const [count, mediaCount] = await Promise.all([
        pendingMutationCount(),
        pendingMediaItemCount(),
      ]);

      const totalFailed = mediaResult.failed + mutResult.failed;
      setState({
        pendingCount: count,
        pendingMediaCount: mediaCount,
        syncing: false,
        lastSyncAt: new Date().toISOString(),
        lastError: totalFailed > 0 ? `${totalFailed} item(s) failed and will retry.` : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed.";
      setState((prev) => ({ ...prev, syncing: false, lastError: msg }));
    } finally {
      drainingRef.current = false;
    }
  }, []);

  const enqueue = useCallback(
    async (mutation: Omit<PendingMutation, "id" | "retry_count" | "last_error" | "next_retry_at">) => {
      const id = await enqueueMutation(mutation);
      await refreshCounts();
      return id;
    },
    [refreshCounts]
  );

  const enqueueMedia = useCallback(
    async (item: Omit<PendingMedia, "id" | "retry_count" | "last_error" | "next_retry_at">) => {
      const id = await enqueuePendingMedia(item);
      await refreshCounts();
      return id;
    },
    [refreshCounts]
  );

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    const unregister = registerSyncTriggers(() => { drain(); });
    return unregister;
  }, [drain]);

  useEffect(() => {
    drain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, drain, enqueue, enqueueMedia };
}
