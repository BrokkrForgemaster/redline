# Offline Sync Design

## Goal

The field app must support real field work during weak signal, offline mode, browser refresh, app relaunch, and native background/foreground transitions. A service worker page cache is not enough.

## Client Stores

Use IndexedDB stores:

- `cachedAssignments`
- `cachedProperties`
- `cachedTemplates`
- `activeRuns`
- `pendingMutations`
- `pendingMedia`
- `syncMetadata`

For native field builds, location breadcrumb storage must use secure/encrypted local storage where available.

## Mutation Outbox

Each queued mutation stores:

- client event UUID
- idempotency key
- action type
- payload
- local timestamp
- dependency IDs
- retry count
- last error

## Replay Order

1. Start event
2. Checklist, notes, materials, equipment
3. Media upload and completion
4. Finish event
5. Submit event

## Retry Triggers

- App launch
- App focus/resume
- Browser online event
- Successful authentication refresh
- Manual Sync Now
- Native network availability changes

## Conflict Rules

- Server assignment, permissions, and finalized state win.
- Never overwrite completed or approved records with stale local state.
- Append safe new events where possible.
- Send ambiguous conflicts to admin review.
- UI must not show `Synced` until the server acknowledges the mutation.

## Current Gap

`public/sw.js` caches shell/pages/assets but intentionally sends API and Supabase traffic to the network. The field app currently has no durable mutation queue.
