# Security Model

## Identity

Supabase Auth is the current identity provider. Sessions are refreshed through Next.js middleware and server components read the authenticated user from Supabase cookies.

## Role Mapping

| Target role | Current source |
| --- | --- |
| Owner/Super Admin | `profiles.role = owner` |
| Admin | `profiles.role = administrator` |
| Supervisor/Foreman | `operations_manager`, `snow_operations_manager`, `crew_leader` |
| Employee | `crew_member` |
| Subcontractor | Not implemented yet |
| Auditor/Read-only | `read_only`, with explicit auditor semantics still needed |

## Enforcement Rules

- Server is authoritative for role, assignment, status, distance, approval, and finalized records.
- RLS remains defense in depth.
- High-risk writes must move to server-side command endpoints.
- Retry-prone writes require UUID v4 idempotency keys.
- Status changes must use transition commands, not arbitrary PATCH.
- Privileged transitions, GPS overrides, permission failures, purge runs, report generation, and tracking health changes are audited.

## Media Security

- Routine service evidence should move to private object storage.
- Signed URLs must be short-lived.
- Completed evidence objects are immutable.
- File MIME and signature must be validated server-side.
- EXIF GPS is not trusted for geofence validation.

## Logging

- Do not log auth tokens or secrets.
- Do not put precise location data in generic debug logs.
- Location records belong in authorized tracking/evidence tables only.
