# Stage 02 Progress

## What Changed

- Added an additive Supabase migration for field-service database foundations.
- Enabled PostGIS and added geofence/timezone/instruction fields to existing `properties`.
- Added subcontractor, service template, recurring schedule, work order, assignment, service run, event, GPS, tracking, evidence, media, report, idempotency, audit event, retention hold, and purge-run tables.
- Added baseline RLS policies for initial read access while future `/api/v1` command handlers enforce writes.

## Files/Migrations Added

- `supabase/migrations/007_field_service_foundation.sql`

## Tests Added

- No new TypeScript tests in this stage.
- The prior policy tests cover state transition, geofence decision, idempotency key, and retention eligibility rules that this schema supports.

## Manual Verification Performed

- `npm run test` passed: 4 test files, 12 tests.
- `NEXT_PRIVATE_BUILD_WORKER_COUNT=1 npm run build` passed.
- Checked for local `supabase` CLI and `psql`; neither is available in this workspace, so the SQL migration still needs to be applied and verified against a staging Supabase/PostgreSQL database.

## Known Issues

- The migration is additive but large; it must be applied to a staging database before production.
- `employee_location_points` currently creates a default partition. Time-range partitions should be created by a scheduled maintenance migration/job before high-volume production tracking.
- API route handlers are not implemented yet.
- Native background tracking is still not implemented.
- Existing lint debt remains outside this migration.

## Rollback/Recovery Note

- This migration does not drop existing tables or columns.
- If rollback is required before production data is written to the new tables, drop the new tables, indexes, policies, and enum types from this migration and remove the added `properties` columns.
- If production data has been written, snapshot affected tables first and rollback by disabling new code paths rather than dropping data.

## Next Stage

Implement the first `/api/v1` server-authoritative endpoints: `GET /me`, `GET /me/assignments`, idempotency helper persistence, and work-order/service-run start command skeleton using the policy modules.
