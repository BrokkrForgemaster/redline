# Stage 04 Progress

## What Changed

- Added subcontractor assignment access checks to the service-run command layer.
- Added IndexedDB field database schema and primitives.
- Added a mutation outbox with durable replay ordering and exponential-backoff retry.
- Added sync trigger registration (focus, online, visibility restore, launch).
- Added React hooks for the field client: `useAssignments` and `useOutbox`.

## Files Added / Modified

- `lib/api/service-access.ts` — extended `requireServiceRunAccess` to check `subcontractor_memberships` and `subcontractor_company_id` assignments; subcontractors now pass the access gate alongside employees and crew.
- `lib/field/db.ts` — opens `redline-field-v1` IndexedDB; upgrades to version 1 with stores: `cachedAssignments`, `cachedProperties`, `cachedTemplates`, `activeRuns`, `pendingMutations`, `pendingMedia`, `syncMetadata`; exports IDB helper primitives.
- `lib/field/outbox.ts` — `enqueueMutation`, `pendingMutationCount`, `drainOutbox`; enforces replay order (start → checklist/notes/materials/equipment → media-complete → finish → submit); handles idempotent replay (409/ALREADY_PROCESSED counts as success); terminal HTTP errors (401/403/404) discard rather than retry; max 5 retries with exponential backoff capped at 5 minutes.
- `lib/field/sync.ts` — `registerSyncTriggers` wires `window focus`, `window online`, and `document visibilitychange` events; exports `isTerminalServerStatus` and `shouldDiscardLocalMutation` conflict-rule helpers.
- `lib/field/useAssignments.ts` — client React hook; serves stale IndexedDB cache immediately (TTL 5 min), then fetches `/api/v1/me/assignments` and writes result back to cache; exposes `data`, `loading`, `error`, `fromCache`, `refetch`.
- `lib/field/useOutbox.ts` — client React hook; wraps `drainOutbox` and `enqueueMutation`; drains on mount (launch) and on every sync trigger; exposes `pendingCount`, `syncing`, `lastSyncAt`, `lastError`, `drain`, `enqueue`.

## Tests

- No new unit test files in this stage.
- Existing 12 policy tests continue to pass.

## Manual Verification Performed

- `npm run test` passed: 4 test files, 12 tests.
- `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` passed.

## Known Issues

- Migrations 007 and 008 still need to be applied to staging.
- `useAssignments` and `useOutbox` are client components only; the existing `/my-jobs` server component does not yet use them. Wiring the field navigation shell (My Jobs list, Active Job view, Sync status bar) to these hooks is the next stage.
- `pendingMedia` outbox and signed upload flow are not yet implemented — only mutation metadata is queued.
- Native secure local breadcrumb storage is still not implemented.

## Rollback/Recovery Note

- All new files are additive; no existing routes or server actions were removed.
- `lib/api/service-access.ts` change is backward compatible: the new subcontractor check only runs when no direct or crew assignment is found, so existing employee/crew flows are unaffected.

## Next Stage

Wire the field navigation shell to `useAssignments` and `useOutbox`:
- Convert `/my-jobs` list to a client component that reads IndexedDB-backed assignments via `useAssignments`.
- Add a persistent sync status indicator to the field shell.
- Add Active Job view that calls `/api/v1/service-runs/:id/*` through `useOutbox.enqueue`.
- Add offline banner that reacts to `navigator.onLine`.
