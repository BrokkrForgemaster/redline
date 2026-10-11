# Stage 03 Progress

## What Changed

- Added initial `/api/v1` integration routes.
- Added shared API auth, error, and idempotency helpers.
- Added a PostGIS-backed geofence distance RPC migration.
- Implemented:
  - `GET /api/v1/me`
  - `GET /api/v1/me/assignments`
  - `POST /api/v1/work-orders/:id/start`
  - `POST /api/v1/service-runs/:id/pause`
  - `POST /api/v1/service-runs/:id/resume`
  - `POST /api/v1/service-runs/:id/finish`
  - `POST /api/v1/service-runs/:id/submit`
  - `POST /api/v1/tracking/work-sessions/start`
  - `POST /api/v1/tracking/work-sessions/stop`
  - `POST /api/v1/tracking/points/batch`
  - `POST /api/v1/tracking/health-events`

## Files/Migrations Added

- `supabase/migrations/008_geofence_distance_function.sql`
- `lib/api/auth.ts`
- `lib/api/errors.ts`
- `lib/api/idempotency.ts`
- `app/api/v1/me/route.ts`
- `app/api/v1/me/assignments/route.ts`
- `app/api/v1/work-orders/[id]/start/route.ts`
- `app/api/v1/service-runs/[id]/pause/route.ts`
- `app/api/v1/service-runs/[id]/resume/route.ts`
- `app/api/v1/service-runs/[id]/finish/route.ts`
- `app/api/v1/service-runs/[id]/submit/route.ts`
- `app/api/v1/tracking/work-sessions/start/route.ts`
- `app/api/v1/tracking/work-sessions/stop/route.ts`
- `app/api/v1/tracking/points/batch/route.ts`
- `app/api/v1/tracking/health-events/route.ts`
- `lib/api/service-access.ts`

## Tests Added

- No new unit test files in this stage.
- Routes use the existing tested policy modules for state transitions, geofence decisions, and idempotency key format.

## Manual Verification Performed

- `npm run test` passed: 4 test files, 12 tests.
- `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` passed.
- `NODE_OPTIONS=--max-old-space-size=4096 NEXT_PRIVATE_BUILD_WORKER_COUNT=1 npm run build` passed and listed the new `/api/v1` routes.
- Default-memory build attempts hit Node heap pressure before the memory setting was applied.

## Known Issues

- These endpoints depend on migrations `007` and `008` being applied.
- Migrations still need to be applied and verified against a staging Supabase/PostgreSQL database because local `supabase` CLI/`psql` are unavailable in this workspace.
- Work-order/service-run command access currently covers employee and crew assignments; subcontractor assignment enforcement needs the next pass.
- Tracking endpoints persist sessions, health events, and breadcrumb batches, but native secure local buffering and real device background tests are not implemented yet.
- `GET /api/v1/me/assignments` intentionally returns legacy jobs too, so the mobile UI can migrate incrementally.

## Rollback/Recovery Note

- Routes are additive and do not replace existing server actions.
- If the new API routes need to be disabled, remove or guard the `/api/v1` route files without affecting the existing field pages.

## Next Stage

Apply migrations to staging, add subcontractor-specific access checks, and wire the mobile field client to these `/api/v1` endpoints with IndexedDB outbox support.
