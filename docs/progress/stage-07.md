# Stage 07 Progress

## What Changed

### Photo Count Hydration (Item 1)
- Added `GET /api/v1/service-runs/:id/media` — returns `{ counts: { before, after }, assets: [] }` for confirmed uploads (`status IN ('uploaded','attached','finalized')`). Access-controlled via `requireServiceRunAccess`.
- Extended `StoredActiveRun` with `beforeCount` and `afterCount` fields.
- Extended `ActiveRunState` with `beforeCount` and `afterCount` (default 0).
- Updated `useActiveRun` hydration: after fetching the active run from the server, immediately calls the media endpoint for counts. Both are stored to IndexedDB via `saveActiveRun`. Photo counts now survive page reload.
- Run page now drives `PhotoSection` from `run.beforeCount`/`run.afterCount` via `updateRun(...)` instead of local-only state.

### Offline Photo Queuing (Item 2)
- Updated `PendingMedia` interface: removed `mutation_id`, added `evidence_type`, `byte_size`, `next_retry_at`.
- Added to `outbox.ts`: `enqueuePendingMedia`, `pendingMediaItemCount`, `drainPendingMedia`. The drain function does presign → Supabase SDK `uploadToSignedUrl` → complete for each queued blob, with 5-retry exponential backoff (matches mutation retry logic). Terminal errors (403/404/409) discard the item without retry.
- Updated `useOutbox`: exposes `pendingMediaCount`; `drain()` now runs `drainPendingMedia` and `drainOutbox` in parallel; adds `enqueueMedia()` to the returned API.
- Updated `SyncStatusBar`: accepts optional `pendingMediaCount` prop; pending label distinguishes "2 changes + 3 photos pending sync".
- Updated run page photo capture: tries the online path (presign → upload → complete) first; on any failure, falls back to `outbox.enqueueMedia(blob)`. Count increment is optimistic in both cases. Toast messages indicate whether photos were uploaded or queued.
- Both My Jobs list and run page pass `pendingMediaCount` to `SyncStatusBar`.

### Admin Review Flow (Items 3 & 4)
- Added `requireStaffUser(minRole)` to `lib/api/auth.ts` — checks `profiles.role` against `STAFF_ROLES` (any staff) or `REVIEWER_ROLES` (owner/admin/ops_manager). Returns 403 for non-staff.
- Added `GET /api/v1/service-runs` — staff-facing list, filterable by `status` (default: `submitted`), paginated. Returns run summaries with worker and work order info.
- Added `GET /api/v1/service-runs/:id` — staff detail: full run, signed download URLs (15 min TTL) for all confirmed media assets, notes, and events.
- Added `POST /api/v1/service-runs/:id/approve` — reviewer-only; transitions `submitted|needs_review → completed`; sets `frozen_at`.
- Added `POST /api/v1/service-runs/:id/reject` — reviewer-only; requires `reason` body; transitions `submitted|needs_review → rejected`.
- Added `app/(app)/service-runs/page.tsx` — tabbed list (Needs Review / In Review / Approved / Rejected) with status badges, worker name, job title, address, duration, submitted date.
- Added `app/(app)/service-runs/[id]/page.tsx` — detail page with before/after photo galleries (lightbox on tap), field notes accordion, job info, and inline approve/reject flow (reject requires reason text).
- Added "Service Runs" under the Operations nav group in `Sidebar.tsx`.

## Files Added / Modified

- `app/api/v1/service-runs/route.ts` — new GET (staff list)
- `app/api/v1/service-runs/[id]/route.ts` — new GET (staff detail)
- `app/api/v1/service-runs/[id]/media/route.ts` — new GET (counts + asset list)
- `app/api/v1/service-runs/[id]/approve/route.ts` — new POST
- `app/api/v1/service-runs/[id]/reject/route.ts` — new POST
- `lib/api/auth.ts` — added `requireStaffUser`, `STAFF_ROLES`, `REVIEWER_ROLES`
- `lib/field/db.ts` — updated `PendingMedia` interface
- `lib/field/activeRunStore.ts` — added `beforeCount`, `afterCount` to `StoredActiveRun`
- `lib/field/useActiveRun.ts` — hydrates photo counts from server; exposes them in `ActiveRunState`
- `lib/field/outbox.ts` — added `enqueuePendingMedia`, `pendingMediaItemCount`, `drainPendingMedia`
- `lib/field/useOutbox.ts` — drains pending media, exposes `pendingMediaCount`, `enqueueMedia`
- `components/field/SyncStatusBar.tsx` — optional `pendingMediaCount` prop; smarter pending label
- `app/(app)/my-jobs/run/[workOrderId]/page.tsx` — offline photo queuing + server-hydrated counts
- `app/(app)/my-jobs/page.tsx` — passes `pendingMediaCount` to SyncStatusBar
- `app/(app)/service-runs/page.tsx` — new admin list page
- `app/(app)/service-runs/[id]/page.tsx` — new admin detail page
- `components/app/Sidebar.tsx` — added Service Runs to Operations group

## Tests

- 4 test files, 12 tests — all pass.
- `npx tsc --noEmit` — clean.

## Prerequisites Before Testing End-to-End

- **Run migrations 007 through 011** against your Supabase instance before any of the new API routes will work.
- The `service-evidence` storage bucket is private and migration-managed by `011_service_storage_buckets.sql`.
- After running migrations, ensure at least one `work_order` and `work_order_assignment` exist to test the field flow.

## Known Issues

- Offline photo queuing stores blobs in IndexedDB. On some iOS browsers (older Safari/WKWebView), IndexedDB blob storage can fail silently; a future stage should detect this and warn the user.
- Signed download URLs in the detail page have a 15-minute TTL. If the reviewer leaves the tab open longer, photos will show broken. A future stage can add a refresh-on-error mechanism.
- The run page photo count is optimistic (incremented on queue, before server confirmation). On sync failure and discard (5 retries exhausted), the count will be stale until the next server hydration.
- The admin list does not yet support multi-status filtering or date range filtering.

## Next Stage

- Apply migrations 007 and 008 to staging; run end-to-end smoke test.
- Add `GET /api/v1/work-orders/:id` for the run page to load the work order directly instead of scanning all assignments.
- Add location event / geofence summary to the admin detail page.
- Customer-facing report generation (PDF from approved service run).
