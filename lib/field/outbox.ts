import { createClient } from "@/lib/supabase/client";
import {
  openFieldDb,
  idbPut,
  idbDelete,
  idbGetAll,
  idbCount,
  type PendingMutation,
  type PendingMedia,
} from "./db";

// Replay order from the offline sync design:
//   1 = start
//   2 = checklist / notes / materials / equipment
//   3 = media upload completion
//   4 = finish
//   5 = submit
const ACTION_ORDER: Record<string, number> = {
  "work-orders:start": 1,
  "service-runs:start": 1,
  "service-runs:checklist": 2,
  "service-runs:notes": 2,
  "service-runs:materials": 2,
  "service-runs:equipment": 2,
  "service-runs:media-complete": 3,
  "service-runs:finish": 4,
  "service-runs:submit": 5,
};

function actionPriority(action: string): number {
  return ACTION_ORDER[action] ?? 2;
}

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 5_000;

function backoffMs(retryCount: number): number {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, retryCount), 300_000);
}

function generateId(): string {
  return crypto.randomUUID();
}

export async function enqueueMutation(
  mutation: Omit<PendingMutation, "id" | "retry_count" | "last_error" | "next_retry_at">
): Promise<string> {
  const db = await openFieldDb();
  const id = generateId();
  const record: PendingMutation = {
    ...mutation,
    id,
    retry_count: 0,
    last_error: null,
    next_retry_at: null,
  };
  await idbPut(db, "pendingMutations", record);
  return id;
}

export async function pendingMutationCount(): Promise<number> {
  const db = await openFieldDb();
  return idbCount(db, "pendingMutations");
}

export interface DrainResult {
  processed: number;
  failed: number;
  skipped: number;
}

export async function enqueuePendingMedia(
  item: Omit<PendingMedia, "id" | "retry_count" | "last_error" | "next_retry_at">
): Promise<string> {
  const db = await openFieldDb();
  const id = generateId();
  const record: PendingMedia = {
    ...item,
    id,
    retry_count: 0,
    last_error: null,
    next_retry_at: null,
  };
  await idbPut(db, "pendingMedia", record);
  return id;
}

export async function pendingMediaItemCount(): Promise<number> {
  const db = await openFieldDb();
  return idbCount(db, "pendingMedia");
}

export async function drainPendingMedia(signal?: AbortSignal): Promise<DrainResult> {
  const db = await openFieldDb();
  const all = await idbGetAll<PendingMedia>(db, "pendingMedia");

  const now = new Date().toISOString();
  const ready = all.filter((m) => m.next_retry_at === null || m.next_retry_at <= now);
  const skipped = all.length - ready.length;
  let processed = 0;
  let failed = 0;

  for (const item of ready) {
    if (signal?.aborted) break;

    try {
      // Step 1: presign
      const presignRes = await fetch(`/api/v1/service-runs/${item.service_run_id}/media/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mime_type: item.mime_type,
          byte_size: item.byte_size,
          evidence_type: item.evidence_type,
        }),
        signal,
      });

      if (!presignRes.ok) {
        // 409 finalized — discard permanently
        if (presignRes.status === 409 || presignRes.status === 403 || presignRes.status === 404) {
          await idbDelete(db, "pendingMedia", item.id);
          failed++;
          continue;
        }
        throw new Error(`Presign HTTP ${presignRes.status}`);
      }

      const { asset_id, bucket, path, token } = await presignRes.json();

      // Step 2: upload blob to Storage via the Supabase JS client
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: uploadError } = await (supabase.storage as any)
        .from(bucket)
        .uploadToSignedUrl(path, token, item.blob, { contentType: item.mime_type });

      if (uploadError) throw uploadError;

      // Step 3: complete
      const completeRes = await fetch(
        `/api/v1/service-runs/${item.service_run_id}/media/${asset_id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ byte_size: item.byte_size }),
          signal,
        }
      );

      if (!completeRes.ok && completeRes.status !== 404) {
        throw new Error(`Complete HTTP ${completeRes.status}`);
      }

      await idbDelete(db, "pendingMedia", item.id);
      processed++;
    } catch (err) {
      if (signal?.aborted) break;

      const newRetryCount = item.retry_count + 1;
      if (newRetryCount >= MAX_RETRIES) {
        await idbDelete(db, "pendingMedia", item.id);
        failed++;
        continue;
      }

      const updated: PendingMedia = {
        ...item,
        retry_count: newRetryCount,
        last_error: err instanceof Error ? err.message : String(err),
        next_retry_at: new Date(Date.now() + backoffMs(newRetryCount)).toISOString(),
      };
      await idbPut(db, "pendingMedia", updated);
      failed++;
    }
  }

  return { processed, failed, skipped };
}

export async function drainOutbox(signal?: AbortSignal): Promise<DrainResult> {
  const db = await openFieldDb();
  const all = await idbGetAll<PendingMutation>(db, "pendingMutations");

  const now = new Date().toISOString();
  const ready = all
    .filter((m) => m.next_retry_at === null || m.next_retry_at <= now)
    .sort((a, b) => {
      const pa = actionPriority(a.action);
      const pb = actionPriority(b.action);
      if (pa !== pb) return pa - pb;
      return a.queued_at < b.queued_at ? -1 : 1;
    });

  const skipped = all.length - ready.length;
  let processed = 0;
  let failed = 0;

  for (const mutation of ready) {
    if (signal?.aborted) break;

    // Block on unresolved dependencies
    const blocked = mutation.dependency_ids.some((depId) =>
      all.some((m) => m.id === depId)
    );
    if (blocked) {
      skipped + 1; // dependency not yet cleared
      continue;
    }

    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": mutation.idempotency_key,
        },
        body: JSON.stringify(mutation.body),
        signal,
      });

      if (res.ok || res.status === 409) {
        // 409 from our API on ALREADY_PROCESSED means idempotent success
        const json = await res.json().catch(() => ({}));
        const isIdempotentReplay =
          res.status === 409 &&
          typeof json === "object" &&
          json !== null &&
          (json as Record<string, unknown>).code === "ALREADY_PROCESSED";

        if (res.ok || isIdempotentReplay) {
          await idbDelete(db, "pendingMutations", mutation.id);
          processed++;
          continue;
        }
      }

      // Terminal errors: auth, not found, state conflict that isn't idempotent replay
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        await idbDelete(db, "pendingMutations", mutation.id);
        failed++;
        continue;
      }

      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (signal?.aborted) break;

      const newRetryCount = mutation.retry_count + 1;
      if (newRetryCount >= MAX_RETRIES) {
        await idbDelete(db, "pendingMutations", mutation.id);
        failed++;
        continue;
      }

      const updated: PendingMutation = {
        ...mutation,
        retry_count: newRetryCount,
        last_error: err instanceof Error ? err.message : String(err),
        next_retry_at: new Date(Date.now() + backoffMs(newRetryCount)).toISOString(),
      };
      await idbPut(db, "pendingMutations", updated);
      failed++;
    }
  }

  return { processed, failed, skipped };
}
