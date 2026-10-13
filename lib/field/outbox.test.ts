import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingMedia, PendingMutation } from "./db";

const { idbGetAll, idbDelete, idbPut, createClient } = vi.hoisted(() => ({
  idbGetAll: vi.fn(), idbDelete: vi.fn(), idbPut: vi.fn(), createClient: vi.fn(),
}));
vi.mock("./db", () => ({ openFieldDb: vi.fn().mockResolvedValue({}),
  idbGetAll, idbDelete, idbPut }));
vi.mock("@/lib/supabase/client", () => ({ createClient }));

import { drainPendingMedia, drainOutbox } from "./outbox";

const userId = "d27ff280-f140-4572-80f9-bc084532fe18";
const runId = "95f0714b-04b7-4477-a352-4829d58fa42b";
const assetId = "0c2249c4-33ba-4593-8e8d-d4fe85d7b3f8";
const media: PendingMedia = {
  id: assetId, owner_user_id: userId, service_run_id: runId,
  blob: new Blob(["photo"]), filename: "photo.jpg", mime_type: "image/jpeg",
  evidence_type: "after", byte_size: 5, queued_at: "2026-10-12T18:00:00Z",
  retry_count: 0, last_error: null, next_retry_at: null,
};

describe("offline photo reconciliation", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockReturnValue({ auth: { getSession: vi.fn().mockResolvedValue({
      data: { session: { user: { id: userId } } }, error: null,
    }) } });
    idbGetAll.mockImplementation(async (_db, store) => store === "pendingMedia" ? [media] : []);
    idbDelete.mockResolvedValue(undefined);
    idbPut.mockResolvedValue(undefined);
  });

  it("reconciles a lost completion response using the same logical photo ID", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ asset_id: assetId, status: "attached" }))
      .mockResolvedValueOnce(Response.json({ asset: { id: assetId, status: "attached" } })));
    const result = await drainPendingMedia();
    expect(result.processed).toBe(1);
    expect(idbDelete).toHaveBeenCalledWith(expect.anything(), "pendingMedia", assetId);
    expect(createClient).toHaveBeenCalledTimes(1); // no second upload
  });

  it("keeps local bytes when completion is ambiguous", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ asset_id: assetId, status: "pending_upload", bucket: "service-evidence", path: "x", token: "x" }))
      .mockResolvedValueOnce(Response.json({ code: "INTERNAL_ERROR" }, { status: 500 })));
    const result = await drainPendingMedia();
    expect(result.failed).toBe(1);
    expect(idbDelete).not.toHaveBeenCalled();
    expect(idbPut).toHaveBeenCalledWith(expect.anything(), "pendingMedia",
      expect.objectContaining({ id: assetId, blob: media.blob, retry_count: 1 }));
  });

  it("holds a finish intent while that visit still has queued evidence", async () => {
    const mutation: PendingMutation = {
      id: "e18c1b04-cbba-40a5-a6ab-8e491f74a251", owner_user_id: userId,
      idempotency_key: "087d41bd-fbd6-46cb-a5cc-f0762e34b1ec",
      action: "service-runs:finish", url: `/api/v1/service-runs/${runId}/finish`,
      method: "POST", body: {}, queued_at: "2026-10-12T18:00:00Z",
      dependency_ids: [], retry_count: 0, last_error: null, next_retry_at: null,
    };
    idbGetAll.mockImplementation(async (_db, store) => store === "pendingMedia" ? [media] : [mutation]);
    vi.stubGlobal("fetch", vi.fn());
    const result = await drainOutbox();
    expect(result.skipped).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retains finish intent when HTTP succeeds without a canonical completion", async () => {
    const mutation: PendingMutation = {
      id: "e18c1b04-cbba-40a5-a6ab-8e491f74a251", owner_user_id: userId,
      idempotency_key: "087d41bd-fbd6-46cb-a5cc-f0762e34b1ec",
      action: "service-runs:finish", url: `/api/v1/service-runs/${runId}/finish`,
      method: "POST", body: {}, queued_at: "2026-10-12T18:00:00Z",
      dependency_ids: [], retry_count: 0, last_error: null, next_retry_at: null,
    };
    idbGetAll.mockImplementation(async (_db, store) => store === "pendingMedia" ? [] : [mutation]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ saved: true })));
    const result = await drainOutbox();
    expect(result.failed).toBe(1);
    expect(idbDelete).not.toHaveBeenCalled();
    expect(idbPut).toHaveBeenCalledWith(expect.anything(), "pendingMutations",
      expect.objectContaining({ id: mutation.id, retry_count: 1 }));
  });
});
