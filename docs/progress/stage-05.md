# Stage 05 Progress

## What Changed

- Converted `/my-jobs` list to a client component backed by `useAssignments` (IndexedDB-cached, offline-capable).
- Added `lib/field/useGps.ts` — React hook wrapping `navigator.geolocation.getCurrentPosition` with high-accuracy options, actionable error messages, and a Promise-based `acquire()` call.
- Added `components/field/OfflineBanner.tsx` — listens to `window online/offline` and `document.visibilityState`; shows an amber banner when the device is offline.
- Added `components/field/SyncStatusBar.tsx` — prop-driven (no internal hook); shows pending count, syncing spinner, error message, and a "Sync now" button.
- Added `app/(app)/my-jobs/run/[workOrderId]/page.tsx` — new service-run execution view for work-order-based assignments:
  - Loads work order from `/api/v1/me/assignments`
  - Start: acquires GPS, calls `/api/v1/work-orders/:id/start` (geofence enforced server-side)
  - Pause / Resume: queued through `useOutbox.enqueue` then drained immediately
  - Finish: acquires GPS, calls `/api/v1/service-runs/:id/finish` directly (GPS required)
  - Submit: queued through `useOutbox.enqueue` and drained
  - Handles OUTSIDE_GEOFENCE / OVERRIDE_REQUIRED with an override-reason textarea
  - Shows live elapsed timer, geofence result badge, GPS error messages
  - Includes OfflineBanner and SyncStatusBar

## Files Added / Modified

- `lib/field/useGps.ts` — new GPS hook
- `components/field/OfflineBanner.tsx` — new offline indicator
- `components/field/SyncStatusBar.tsx` — new prop-driven sync status bar
- `app/(app)/my-jobs/page.tsx` — rewritten as `"use client"` component; uses `useAssignments` + `useOutbox`; renders new work-order assignments (→ `/my-jobs/run/:id`) and legacy jobs (→ `/my-jobs/:jobId`) in separate sections; shows OfflineBanner and SyncStatusBar
- `app/(app)/my-jobs/run/[workOrderId]/page.tsx` — new service-run execution view

## Tests

- No new unit test files in this stage.
- 4 test files, 12 tests — all pass.
- `npx tsc --noEmit` — clean.

## Known Issues

- `/my-jobs/run/[workOrderId]` loads the work order by scanning `GET /api/v1/me/assignments`. This is correct for now but will be replaced by a direct `GET /api/v1/work-orders/:id` endpoint in a future stage.
- Photo capture for service runs (evidence media pipeline) is not yet implemented. The existing `FieldJobView.tsx` photo flow still covers legacy jobs only.
- Pause and resume via outbox assume the server is reachable on drain. If the server is down, they will retry with backoff. A future stage should add optimistic local state that survives a full relaunch (using the `activeRuns` IndexedDB store).
- The `useOutbox` hook is instantiated once per page (My Jobs list, Service Run view). These are separate routes, so they will never be mounted simultaneously.
- Migrations 007 and 008 still need to be applied to staging before the `/api/v1` endpoints are usable end-to-end.

## Rollback/Recovery Note

- `app/(app)/my-jobs/page.tsx` was converted from a server component to a client component. The old server-rendered page can be restored from git history. The `/my-jobs/[jobId]` route and `FieldJobView.tsx` are unchanged.
- All new files are additive.

## Next Stage

- Persist active run state in the `activeRuns` IndexedDB store so the run view can resume correctly after a page reload or app relaunch without re-fetching.
- Add a `GET /api/v1/service-runs/active` endpoint (or similar) to hydrate the active run on mount.
- Implement photo evidence capture for service runs using the `pendingMedia` outbox store.
- Apply migrations 007 and 008 to staging and smoke-test the end-to-end flow.
