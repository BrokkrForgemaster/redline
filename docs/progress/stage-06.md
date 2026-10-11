# Stage 06 Progress

## What Changed

- Added `GET /api/v1/service-runs/active` — returns the current user's in-progress or paused service runs (optionally filtered by `work_order_id` query param). Used to hydrate the run view after page reload.
- Added `POST /api/v1/service-runs/:id/media/presign` — creates a `media_assets` record (status=`pending_upload`) and returns a Supabase signed upload URL. Validates MIME type (JPEG/PNG/WebP/HEIC) and enforces 20 MB size limit.
- Added `POST /api/v1/service-runs/:id/media/:assetId/complete` — marks the asset `attached` after the browser completes the direct upload to Storage. Accepts optional `byte_size`, `width`, `height`.
- Added `lib/field/activeRunStore.ts` — IndexedDB helpers: `saveActiveRun`, `loadActiveRunForWorkOrder`, `clearActiveRun`. Persists run state keyed by `serviceRunId` in the `activeRuns` store.
- Added `lib/field/useActiveRun.ts` — React hook that (1) loads the stored run from IndexedDB on mount (instant), (2) hydrates from `/api/v1/service-runs/active` in the background, and (3) writes every state update back to IndexedDB. Exposes `run`, `updateRun`, `clearRun`.
- Updated `app/(app)/my-jobs/run/[workOrderId]/page.tsx` — switched to `useActiveRun` for state management; run state now survives page reload and app relaunch. Added full photo capture flow: presign → browser-direct upload to `service-evidence` Supabase bucket → complete. Before photos visible while in-progress; after photos visible after finish. `PhotoSection` sub-component handles both accents.

## Files Added / Modified

- `app/api/v1/service-runs/active/route.ts` — new GET endpoint
- `app/api/v1/service-runs/[id]/media/presign/route.ts` — new POST endpoint
- `app/api/v1/service-runs/[id]/media/[assetId]/complete/route.ts` — new POST endpoint
- `lib/field/activeRunStore.ts` — new IndexedDB persistence helpers
- `lib/field/useActiveRun.ts` — new React hook
- `app/(app)/my-jobs/run/[workOrderId]/page.tsx` — updated with active run persistence and photo capture

## Tests

- 4 test files, 12 tests — all pass.
- `npx tsc --noEmit` — clean.

## Known Issues / Prerequisites

- The `service-evidence` Supabase Storage bucket is now migration-managed by `supabase/migrations/011_service_storage_buckets.sql`. Apply migrations through `011` before photo upload testing.
- Migrations 007 and 008 still need to be applied to a staging database.
- Photo count shown in the UI is local-only (incremented per successful upload). On reload, the count resets to 0 — a future stage should fetch the asset count from the server on hydration.
- The `pendingMedia` IndexedDB store is defined but not yet used: photos must be taken while online. Offline photo queuing is deferred to a future stage.
- SHA-256 hashing, thumbnail generation, and private bucket enforcement are Phase 6 items deferred per the migration plan.

## Rollback/Recovery Note

- All new API routes are additive.
- The run page change is contained; `/my-jobs` list and legacy `FieldJobView.tsx` are unchanged.
- Photos uploaded to `service-evidence` can be deleted from the Supabase Storage dashboard; their `media_assets` rows can be removed with a direct DB delete before any finalization.

## Next Stage

- Fetch and display existing photo counts on run hydration (call a `GET /api/v1/service-runs/:id/media` endpoint).
- Add offline photo queueing via the `pendingMedia` IndexedDB store.
- Apply migrations 007 and 008 to staging and run an end-to-end smoke test.
- Begin the admin review flow: list submitted service runs, show evidence, approve/reject.
