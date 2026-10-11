# Migration Plan

Audit date: 2026-10-05

This plan assumes the current Next.js/Supabase implementation remains the foundation. The repository already has useful production-oriented CRM, scheduling, field, storage, and audit pieces, so the safe path is additive migration rather than a rewrite.

## Target Mapping

| Target concept | Current implementation | Migration direction |
| --- | --- | --- |
| PostgreSQL system of record | Supabase/PostgreSQL migrations exist | Keep; add migration-driven normalized tables and PostGIS |
| Auth/session | Supabase Auth with SSR cookies | Keep; harden RBAC and command endpoints |
| Users/roles | `profiles.role`, `permissions`, `role_permissions` | Add normalized role assignment support or carefully extend current model |
| Customers/properties | `customers`, `properties` | Preserve; add timezone, geofence radius, PostGIS geography, contacts/requirements |
| Work orders | `jobs` | Introduce `work_orders`; bridge from existing jobs during transition |
| Assignments | `job_assignments`, `crew_members` | Introduce `work_order_assignments`; preserve old assignments until migrated |
| Service execution | `time_entries`, job status, job photos | Introduce `service_runs`, events, checklist responses, notes/issues/material/equipment usage |
| Continuous tracking | none beyond clock/time entries | Add native-capable tracking contracts, work sessions, breadcrumb tables, health events |
| Geofence | `properties.latitude/longitude` only | Add PostGIS point and server geofence policy service |
| Checklists | `job_checklists`, `job_checklist_items` | Add immutable service template lineages/versions and response tables |
| Media | public Supabase buckets and `job_photos` | Add private evidence media flow and `media_assets`; migrate old job photos |
| Reports | PDF dependency present, no version table | Add `report_versions` and async generation path |
| Offline sync | service worker cache only | Add IndexedDB cache/outbox, idempotent `/api/v1` mutations, conflict handling |
| Audit | `audit_logs`, `logAudit` | Preserve; add required audit events for transitions, overrides, purge, tracking |
| Retention/purge | none found | Add retention policy tables/process docs before destructive purge features |

## Safe Phases

### Phase 0: Documentation Baseline

- Complete and maintain `docs/current-system-audit.md`.
- Keep this migration plan updated after each stage.
- Do not alter schema or architecture in this phase.

### Phase 1: Contracts and Guardrails

- Add architecture, security, retention, offline sync, OpenAPI, and mobile acceptance docs.
- Define `/api/v1` error codes, idempotency-key behavior, state transition matrix, RBAC role mapping, and geofence policy contract.
- Decide naming compatibility for current roles:
  - `owner` maps to Owner/Super Admin.
  - `administrator` maps to Admin.
  - `operations_manager`, `snow_operations_manager`, `crew_leader` map to Supervisor/Foreman capabilities.
  - `crew_member` maps to Employee.
  - Add Subcontractor and Auditor/Read-only semantics explicitly.

### Phase 2: Additive Database Foundation

- Add migrations without dropping current tables.
- Enable PostGIS.
- Add property geography/geofence/timezone fields and a GIST index.
- Add target service execution tables alongside current jobs:
  - service templates and template versions
  - work orders and assignments
  - service runs/events/evidence tables
  - work sessions, location points, tracking health, devices
  - idempotency, retention holds, purge runs, report versions
- Add compatibility/backfill migrations from `jobs`, `job_assignments`, `job_checklists`, and `job_photos`.
- Keep old columns/tables readable until app routes are migrated.

### Phase 3: Server-Authoritative API Layer

- Create `/api/v1/me` and `/api/v1/me/assignments`.
- Implement idempotency-key persistence before retry-prone writes.
- Replace direct field server actions with command endpoints for start, pause, resume, finish, submit, media presign/complete, and tracking upload.
- Add a centralized work-order/service-run state machine.
- Ensure every privileged transition writes audit records.

### Phase 3A: Native-Capable Field Runtime

- Add Capacitor or equivalent native shell for the employee field app while retaining shared web UI/business logic.
- Define native background location plugin integration and secure local point storage.
- Add visible tracking-state UI and health-event upload.
- Do not claim continuous background tracking is complete until tested on real iPhone and Android devices with lock/background/relaunch scenarios.

### Phase 4: Mobile Field Shell and Offline Outbox

- Reshape field navigation around My Jobs, Active Job, Sync, Account.
- Add IndexedDB stores for assignment/property/template/run caches, pending mutations, pending media, and sync metadata.
- Implement durable replay order:
  1. start event
  2. checklist/notes/material/equipment
  3. media upload/complete
  4. finish
  5. submit
- Add clear sync states and conflict handling.
- Keep admin dashboard usable but avoid broad admin redesign until field slice works.

### Phase 5: GPS Verification and Mowing Vertical Slice

- Implement shared geofence policy service.
- Add start/finish GPS verification endpoints and UI.
- Build end-to-end mowing path:
  - admin creates customer/property/template/work order/assignment
  - field worker executes checklist, photos, notes, materials/equipment, finish/submit
  - admin reviews and approves/rejects
  - approval creates immutable report version and hash

### Phase 6: Media Pipeline

- Move service evidence to private object storage.
- Add signed upload or secure server-upload contracts.
- Validate MIME and file signatures.
- Compute SHA-256.
- Generate thumbnails.
- Prevent overwrites once records are completed/approved.
- Migrate or reference legacy `job_photos` without deleting existing objects.

### Phase 7: Snow, Recurrence, Notifications

- Add `snow_service_details` tied to service runs.
- Implement recurring schedule generation that creates concrete work orders.
- Add notification paths for assignment changes, overdue jobs, rejected service, sync/GPS exceptions, and tracking gaps.

### Phase 8: Retention, Backups, Operations

- Implement retention classes, legal holds, purge dry-run/report/audit process.
- Add independent encrypted logical DB backup plan and object-storage lifecycle.
- Add monitoring points for sync, GPS, media, PDF, backups, and growth.

## Current Conflicts With Target Requirements

- Browser-only PWA conflicts with mandatory reliable continuous background tracking.
- Current offline support conflicts with offline-first field requirements because mutations/media are not queued in IndexedDB.
- Public evidence/photo buckets conflict with private immutable evidence storage.
- Direct `jobs.status` updates conflict with server-enforced state transitions.
- Current `jobs` model conflicts with separate work order/service run/report immutability requirements.
- Current property geolocation fields conflict with PostGIS authoritative geofence calculations.
- Current job checklists conflict with immutable template versions.
- Current time tracking conflicts with work-session and high-volume breadcrumb tracking requirements.
- No test suite/CI conflicts with staged Definition of Done.

## Smallest Safe First Implementation Batch

After Stage 0, the smallest safe batch is documentation plus non-breaking contracts:

1. Add Stage 1 docs and OpenAPI skeleton for `/api/v1`.
2. Add a state transition matrix and RBAC mapping document based on current roles.
3. Add a test script and minimal Vitest setup without changing production behavior.
4. Add unit tests for pure policy modules introduced in the next step: state transitions, geofence policy inputs/outputs, idempotency behavior, and retention eligibility.
5. Only then add an additive migration for PostGIS/property geofence fields and idempotency/audit support.

This avoids disturbing existing customer/job/admin workflows while creating the guardrails needed for field-service execution.

## Rollback and Recovery Approach

- Use additive migrations first; avoid dropping existing tables/columns until replacement paths have run in production.
- For each migration, include a rollback note in `docs/progress/stage-XX.md`.
- Backfill in idempotent scripts that can be rerun.
- Keep legacy pages reading old tables until new tables are populated and validated.
- For finalized evidence/report features, migrate by adding new immutable rows rather than rewriting existing `job_photos` or job history.
