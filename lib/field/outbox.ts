import { createClient } from "@/lib/supabase/client";
import {
  openFieldDb,
  idbPut,
  idbDelete,
  idbGet,
  idbGetAll,
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

async function currentUserId(): Promise<string> {
  const { data: { session }, error } = await createClient().auth.getSession();
  if (error || !session?.user) throw new Error("Sign in to access saved field work.");
  return session.user.id;
}

export async function enqueueMutation(
  mutation: Omit<PendingMutation, "id" | "retry_count" | "last_error" | "next_retry_at">
): Promise<string> {
  const db = await openFieldDb();
  const owner_user_id = await currentUserId();
  const id = generateId();
  const record: PendingMutation = {
    ...mutation,
    owner_user_id,
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
  const userId = await currentUserId();
  return (await idbGetAll<PendingMutation>(db, "pendingMutations")).filter(m => m.owner_user_id === userId).length;
}

export async function isMutationPending(id: string): Promise<boolean> {
  const db = await openFieldDb();
  const userId = await currentUserId();
  const item = await idbGet<PendingMutation>(db, "pendingMutations", id);
  return item?.owner_user_id === userId;
}

export interface DrainResult {
  processed: number;
  failed: number;
  skipped: number;
}

export async function enqueuePendingMedia(
  item: Omit<PendingMedia, "id" | "retry_count" | "last_error" | "next_retry_at"> & { id?: string }
): Promise<string> {
  const db = await openFieldDb();
  const owner_user_id = await currentUserId();
  const id = item.id ?? generateId();
  const record: PendingMedia = {
    ...item,
    owner_user_id,
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
  const userId = await currentUserId();
  return (await idbGetAll<PendingMedia>(db, "pendingMedia")).filter(m => m.owner_user_id === userId).length;
}

export async function drainPendingMedia(signal?: AbortSignal): Promise<DrainResult> {
  const db = await openFieldDb();
  const all = await idbGetAll<PendingMedia>(db, "pendingMedia");
  const userId = await currentUserId();

  const now = new Date().toISOString();
  const ready = all.filter((m) => m.owner_user_id === userId && m.retry_count < MAX_RETRIES &&
    (m.next_retry_at === null || m.next_retry_at <= now));
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
          asset_id: item.id,
          mime_type: item.mime_type,
          byte_size: item.byte_size,
          evidence_type: item.evidence_type,
        }),
        signal,
      });

      if (!presignRes.ok) {
        // 409 finalized — discard permanently
        throw new Error(`Presign HTTP ${presignRes.status}`);
      }

      const { asset_id, bucket, path, token } = await presignRes.json();
      if (asset_id !== item.id) throw new Error("Photo ID was not confirmed by the server.");

      const completeUrl = `/api/v1/service-runs/${item.service_run_id}/media/${asset_id}/complete`;
      const reconcileRes = await fetch(completeUrl, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal,
      });
      if (reconcileRes.ok) {
        const reconciled = await reconcileRes.json();
        if (reconciled?.asset?.id !== asset_id || reconciled.asset.status !== "attached") {
          throw new Error("Previously uploaded photo was not verified.");
        }
        await idbDelete(db, "pendingMedia", item.id);
        processed++;
        continue;
      }
      const reconcileError = await reconcileRes.json().catch(() => ({}));
      if (reconcileRes.status !== 409 || reconcileError.code !== "VALIDATION_ERROR") {
        throw new Error(`Photo reconciliation ${reconcileRes.status}: ${reconcileError.code ?? "UNKNOWN"}`);
      }
      if (!bucket || !path || !token) throw new Error("Upload permission was not returned.");

      // Step 2: upload blob to Storage via the Supabase JS client
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: uploadError } = await (supabase.storage as any)
        .from(bucket)
        .uploadToSignedUrl(path, token, item.blob, { contentType: item.mime_type });

      if (uploadError) throw uploadError;

      // Step 3: complete
      const completeRes = await fetch(
        completeUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ byte_size: item.byte_size }),
          signal,
        }
      );

      if (!completeRes.ok) {
        throw new Error(`Complete HTTP ${completeRes.status}`);
      }

      const completion = await completeRes.json();
      if (completion?.asset?.id !== asset_id || completion.asset.status !== "attached") {
        throw new Error("Media completion was not confirmed by the server.");
      }

      await idbDelete(db, "pendingMedia", item.id);
      processed++;
    } catch (err) {
      if (signal?.aborted) break;

      const newRetryCount = item.retry_count + 1;
      const updated: PendingMedia = {
        ...item,
        retry_count: newRetryCount,
        last_error: err instanceof Error ? err.message : String(err),
        next_retry_at: newRetryCount >= MAX_RETRIES ? null : new Date(Date.now() + backoffMs(newRetryCount)).toISOString(),
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
  const media = await idbGetAll<PendingMedia>(db, "pendingMedia");
  const userId = await currentUserId();
  const unresolvedMutationIds = new Set(all.map((item) => item.id));
  const unresolvedMediaRuns = new Set(media.filter((item) => item.owner_user_id === userId)
    .map((item) => item.service_run_id));

  const now = new Date().toISOString();
  const ready = all
    .filter((m) => m.owner_user_id === userId && m.retry_count < MAX_RETRIES &&
      (m.next_retry_at === null || m.next_retry_at <= now))
    .sort((a, b) => {
      const pa = actionPriority(a.action);
      const pb = actionPriority(b.action);
      if (pa !== pb) return pa - pb;
      return a.queued_at < b.queued_at ? -1 : 1;
    });

  let skipped = all.length - ready.length;
  let processed = 0;
  let failed = 0;

  for (const mutation of ready) {
    if (signal?.aborted) break;

    // Block on unresolved dependencies
    const blocked = mutation.dependency_ids.some((depId) => unresolvedMutationIds.has(depId)) ||
      (mutation.action === "service-runs:finish" &&
        unresolvedMediaRuns.has(mutation.url.match(/service-runs\/([^/]+)\/finish/)?.[1] ?? ""));
    if (blocked) {
      skipped += 1;
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

        const result = json as Record<string, unknown>;
        const visit = result?.service_run as { id?: string; status?: string } | undefined;
        const expectedRunId = mutation.action === "service-runs:finish"
          ? mutation.url.match(/service-runs\/([^/]+)\/finish/)?.[1]
          : (mutation.body as { service_run_id?: string } | null)?.service_run_id;
        const visitConfirmed = mutation.action === "service-runs:finish"
          ? visit?.id === expectedRunId && visit?.status === "completed"
          : mutation.action === "work-orders:start"
            ? visit?.id === expectedRunId && visit?.status === "in_progress"
            : true;
        if (((res.ok && json && typeof json === "object" && !result.error && visitConfirmed) || isIdempotentReplay)) {
          await idbDelete(db, "pendingMutations", mutation.id);
          unresolvedMutationIds.delete(mutation.id);
          processed++;
          continue;
        }
      }

      // Terminal errors: auth, not found, state conflict that isn't idempotent replay
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (signal?.aborted) break;

      const newRetryCount = mutation.retry_count + 1;
      const updated: PendingMutation = {
        ...mutation,
        retry_count: newRetryCount,
        last_error: err instanceof Error ? err.message : String(err),
        next_retry_at: newRetryCount >= MAX_RETRIES ? null : new Date(Date.now() + backoffMs(newRetryCount)).toISOString(),
      };
      await idbPut(db, "pendingMutations", updated);
      failed++;
    }
  }

  return { processed, failed, skipped };
}
