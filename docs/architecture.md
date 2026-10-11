# Architecture

## Current Foundation

RedLine remains a Next.js App Router application backed by Supabase Auth, PostgreSQL, Row Level Security, and Supabase Storage. This keeps operating cost low and preserves existing customer, property, job, crew, snow, inventory, invoice, media, and audit functionality.

## Target Shape

- PostgreSQL is the system of record.
- Supabase Auth remains the primary identity provider unless future requirements prove it insufficient.
- Next.js serves the admin dashboard and shared web UI.
- The employee field application shares UI/business logic but must be packaged in a native shell, such as Capacitor, for reliable background location.
- API writes move under `/api/v1` command endpoints with idempotency keys.
- Server-side policy modules own state transitions, geofence decisions, RBAC checks, retention eligibility, and idempotency behavior.
- Object storage holds photos, reports, and backups. The database stores metadata, hashes, and links, not media blobs.

## Data Invariants

- Authoritative timestamps are UTC.
- Property timezone is used for display and local scheduling.
- PostGIS calculates authoritative geofence distance.
- Client-reported distance, role, assignment, status, approval, and finalized-record state are never trusted.
- Completed and approved records are immutable. Corrections are amendments.
- Template versions referenced by service runs are immutable.
- Approval creates a frozen report version.
- Continuous tracking data is separate from long-term service evidence.
- Purge operations are scheduled, audited, legal-hold-aware processes.

## Cost-Control Decisions

- Keep Supabase/PostgreSQL instead of introducing a separate database platform.
- Use additive migrations and compatibility layers instead of rewriting existing tables immediately.
- Keep the admin dashboard as a responsive web app.
- Add a native shell only for the employee field runtime because continuous background tracking requires it.
- Start with simple asynchronous jobs where possible before adding queue infrastructure.

## Migration Strategy

1. Preserve current `jobs`, `customers`, `properties`, `profiles`, `crews`, and `audit_logs`.
2. Add new tables alongside old tables.
3. Backfill and dual-read only where needed.
4. Move field workflows to `/api/v1` command endpoints.
5. Retire old direct status/photo/clock actions after the full mowing slice is stable.
