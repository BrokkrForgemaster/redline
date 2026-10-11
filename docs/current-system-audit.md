# Current System Audit

Audit date: 2026-10-05

## Framework, Runtime, Package Manager

- Application framework: Next.js App Router, `next` 16.1.6.
- UI runtime: React 19.2.3, React DOM 19.2.3.
- Language/tooling: TypeScript 5.x, ESLint 9.x, Tailwind CSS 4.x.
- Local runtime observed: Node.js v24.16.0, npm 11.6.3.
- Package manager in use: npm, based on `package-lock.json`. No `pnpm-lock.yaml`, `yarn.lock`, or Bun lockfile was found.
- Key dependencies:
  - Supabase: `@supabase/ssr` 0.12.0, `@supabase/supabase-js` 2.110.2.
  - Forms/validation: `react-hook-form`, `@hookform/resolvers`, `zod`.
  - UI: Radix UI primitives, `lucide-react`, `sonner`, `recharts`, `react-big-calendar`.
  - PDF/reporting dependency present: `@react-pdf/renderer`.

## Repository Structure

- `app/`: Next.js App Router pages, layouts, and route handlers.
  - `app/(public)/`: marketing/public website pages.
  - `app/(auth)/`: login, forgot/reset password, MFA challenge pages.
  - `app/(app)/`: authenticated business app pages including dashboard, customers, properties, jobs, my-jobs, snow events, inventory, invoices, media, settings, audit logs.
  - `app/api/contact/route.ts`: public contact form API route.
- `components/`: public site components and authenticated app shell components.
- `lib/`: Supabase clients, server actions, validation schemas, utilities, WordPress helpers.
- `public/`: PWA manifest, service worker, logo, and marketing images.
- `supabase/migrations/`: SQL migrations for the current Supabase/PostgreSQL schema and storage buckets.
- `types/database.ts`: generated/manual Supabase database typings.
- `scripts/`: WordPress gallery migration script.
- `docs/`: existed but had no files at audit time.

## Build and Development Commands

From `package.json`:

- `npm run dev`: `next dev`
- `npm run build`: `next build`
- `npm run start`: `next start`
- `npm run lint`: `eslint`

No dedicated test script is configured.

## PWA Manifest, Service Worker, Offline Behavior

- Manifest: `public/manifest.json`.
  - Name: Redline Landscaping & Snow Removal.
  - Start URL: `/dashboard`.
  - Display: `standalone`.
  - Theme color: `#B11226`.
  - Icon: `/images/logo.png` with `sizes: "any"`.
- Service worker: `public/sw.js`, registered inline from `app/layout.tsx`.
  - Precaches public marketing pages and `/offline`.
  - Uses cache-first for static assets.
  - Uses stale-while-revalidate for public pages.
  - Uses network-first cache fallback for authenticated/admin navigations.
  - Explicitly treats `/api/`, Supabase hosts, auth flows, and `/_next/data/` as network-only.
- Current offline support is an app/page cache only. There is no IndexedDB field cache, no durable mutation outbox, no pending media queue, no idempotent sync replay, and no offline-aware API contract.
- There is no native wrapper, Capacitor setup, or native background location runtime.

## Authentication and Session Implementation

- Auth provider: Supabase Auth.
- Browser client: `lib/supabase/client.ts` uses `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server client: `lib/supabase/server.ts` uses `createServerClient` with cookie integration.
- Middleware: `middleware.ts` delegates to `lib/supabase/middleware.ts`, refreshes session with `supabase.auth.getUser()`, and redirects unauthenticated users away from protected routes.
- Login: `app/(auth)/login/LoginForm.tsx` uses `supabase.auth.signInWithPassword`, checks verified TOTP factors, and redirects to `/mfa/challenge` when required.
- App layout: `app/(app)/layout.tsx` requires an authenticated user, loads `profiles`, signs out disabled/suspended users, then renders `AppShell`.

## Roles and Authorization

- Current primary role model is a single `profiles.role` enum value.
- `app_role` enum includes: `owner`, `administrator`, `operations_manager`, `office_manager`, `estimator`, `crew_leader`, `crew_member`, `snow_operations_manager`, `inventory_manager`, `bookkeeper`, `read_only`, `customer`.
- Permission tables exist: `permissions`, `role_permissions`.
- RLS policies exist for major tables in `002_rls_policies.sql`.
- Helper functions exist: `auth_role()`, `is_staff()`, `is_owner_or_admin()`, `is_financial_role()`, `can_manage_field_work()`.
- Field access currently relies primarily on crew membership, job assignment policies, and page/action queries.
- Gap against target: no normalized `users`, `roles`, `user_roles` model; no subcontractor company/membership model; no explicit Auditor role name; server actions still perform direct mutations and status updates instead of command endpoints with centralized transition/RBAC enforcement.

## Database, Migrations, and Schema

- Database: PostgreSQL via Supabase.
- Current migrations:
  - `001_initial_schema.sql`
  - `002_rls_policies.sql`
  - `003_permissions_seed.sql`
  - `004_gallery_storage.sql`
  - `005_avatars_storage.sql`
  - `006_job_photos.sql`
- Extensions enabled: `uuid-ossp`, `pgcrypto`.
- PostGIS is not enabled.
- Existing tables include:
  - Core/accounting/settings: `business_settings`, `profiles`, `permissions`, `role_permissions`, `document_sequences`.
  - Customer/site: `customers`, `properties`.
  - Sales/contracts: `leads`, `estimates`, `estimate_items`, `contracts`.
  - Field ops: `crews`, `crew_members`, `jobs`, `job_assignments`, `job_status_history`, `job_checklists`, `job_checklist_items`, `job_notes`, `time_entries`.
  - Snow/routing: `snow_events`, `routes`, `route_stops`.
  - Finance/inventory/assets: `invoices`, `invoice_items`, `payments`, `products`, `suppliers`, `inventory_transactions`, `purchase_orders`, `purchase_order_items`, `assets`.
  - Media/notifications/audit: `gallery_projects`, `gallery_images`, `gallery_consents`, `notifications`, `audit_logs`, `job_photos`.
- Existing property location uses nullable `latitude NUMERIC(10,7)` and `longitude NUMERIC(10,7)`. There is no geography point, geofence radius, timezone per property, or PostGIS GIST index.
- Existing jobs mix work order, recurrence, scheduling, and execution concepts in one `jobs` table.
- Existing job checklists are mutable job-scoped tables, not immutable versioned service templates.
- Existing `time_entries` supports clock-in/out but not continuous authorized work sessions or high-volume breadcrumb tracking.

## API and Server Routes

- Route handlers found:
  - `POST /api/contact`: forwards public quote/contact requests to FormSubmit.
- Most authenticated mutations are implemented as Next.js server actions in `lib/actions/*`.
- Existing actions include customer, property, job, field, inventory, invoice, estimate, lead, crew, gallery, profile, settings, snow-event, and audit operations.
- Representative field actions:
  - `clockIn(jobId)`: creates a `time_entries` record and updates `jobs.status` to `in_progress` when current status is in an allowed list.
  - `clockOut(entryId, jobId)`: sets `clock_out` on the open time entry.
  - `uploadJobPhoto(formData, jobId, type)`: uploads to Supabase Storage using `SUPABASE_SERVICE_ROLE_KEY`, stores a `job_photos` row.
- There is no `/api/v1` namespace and no OpenAPI document.
- There are no current tracking, geofence, idempotency, media presign/complete, or approval/report version endpoints.

## File and Photo Storage

- Storage provider: Supabase Storage.
- Buckets:
  - `gallery`: public, max 10 MB, broad image MIME allow-list.
  - `avatars`: public, max 5 MB.
  - `job-photos`: public, max 15 MB.
- `job_photos` stores `storage_path`, public `url`, `photo_type`, employee, job, and timestamps.
- Current field photo upload path uses server-side service-role Supabase client from a server action.
- Gaps:
  - Evidence buckets are public, not private.
  - No signed upload contract.
  - No immutable object key/report finalization policy beyond `upsert: false`.
  - No server-side file signature validation, SHA-256, thumbnail pipeline, or completed-record immutability.
  - No pending offline media queue.

## Scheduling, Jobs, Properties, Customers

- `customers` has contact/billing fields, status, portal access, tags, soft-delete timestamp.
- `properties` has address, property/service area measurements, access notes, hazards, pets, service restrictions, `active`, latitude/longitude, soft delete.
- `jobs` has customer, property, estimate, contract, invoice, service type, priority, status, title, description, crew, scheduled date/start/end, actual start/end, estimated/actual hours, instructions, recurrence fields, and parent job.
- `job_assignments` links jobs to employee profiles.
- `routes` and `route_stops` provide separate route planning.
- `snow_events` exists for event-level snow operations.
- Recurrence is currently a text `recurrence_rule` on `jobs`, not a separate recurring schedule generator that creates concrete work orders.

## Deployment and Environment Variables

- README references Vercel-style Next.js deployment.
- No `Dockerfile`, Compose file, Vercel config, Netlify config, or GitHub Actions workflow was found by the audit scan.
- Environment variable names observed:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_DB_PASSWORD`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SITE_URL`
  - `WORDPRESS_BASE_URL`
- No secret values were copied into this document.

## Tests and CI/CD

- Test-related dependencies are installed: Vitest, Testing Library, jsdom.
- No `test` script exists in `package.json`.
- No test files were found by searching for common Vitest/Jest/Testing Library patterns outside `node_modules`.
- No Playwright setup was found.
- No CI workflow files were found.

## Reusable Components and Features

Preserve or build on:

- Supabase Auth/session integration and middleware.
- Existing PostgreSQL/Supabase foundation and migration directory.
- Existing customer/property/job/crew/snow/inventory/invoice/admin screens where they match target operations.
- Existing RLS policies as a starting point, while moving critical mutations behind server-authoritative command handlers.
- `audit_logs` and `logAudit` as a starting point for operational audit events.
- `AppShell`, `Sidebar`, `TopBar`, `MobileNav`, and mobile field pages as UI starting points.
- Existing marketing/public site, image assets, WordPress gallery migration script, and SEO metadata.

## Technical Debt, Security Issues, Data-Loss Risks, and Migration Risks

- Service worker gives a false impression of offline readiness for field work; API/Supabase mutations are network-only and there is no durable local outbox.
- Browser-only PWA cannot satisfy continuous background location when mobile OS suspends web execution.
- Field clock-in/out is not tied to geofence verification, high-accuracy location capture, assignment authorization expiration, or idempotency.
- Status updates can be arbitrary direct updates through `updateJobStatus`; no centralized state machine validates transitions and side effects.
- Evidence photos are stored in public buckets with public URLs.
- Server-side storage upload does not currently validate file signatures, compute hashes, generate thumbnails, or use immutable finalized media semantics.
- `properties` lacks PostGIS geography, geofence radius, and timezone fields required by the target system.
- `jobs` combines scheduling and execution; migration must avoid breaking existing operational pages while introducing `work_orders` and `service_runs`.
- Current job checklist tables are mutable per-job data and do not satisfy immutable template version requirements.
- Completed/approved service records and reports do not exist as immutable/versioned entities.
- Audit logging is best-effort and swallows failures; that is acceptable for current CRUD but insufficient for privileged transitions and purge/report events.
- `SUPABASE_SERVICE_ROLE_KEY` is used server-side for uploads; this must remain server-only and must not migrate into client code.
- Existing RLS is useful but not enough: target requires server-side RBAC/state enforcement, especially for subcontractors and finalized records.
- No tests/CI means regression risk is high. Add tests incrementally before and during schema/API changes.

## Preserve, Refactor, Migrate, Retire

Preserve:

- Next.js App Router structure.
- Supabase Auth and PostgreSQL/Supabase base, unless a later stage proves the current Supabase project is unsuitable.
- Existing CRM/admin modules: customers, properties, jobs, crews, snow events, inventory, invoices, media gallery.
- Existing migrations; add new migrations instead of deleting or replacing them.

Refactor:

- Field worker routes into a mobile-first shell with bottom navigation focused on My Jobs, Active Job, Sync, Account.
- Server actions for field work into `/api/v1` command endpoints with idempotency keys.
- Status mutation logic into a centralized server-side state machine.
- Media upload into private object storage with validation, hashes, thumbnails, and immutable keys.

Migrate:

- `properties.latitude/longitude` to authoritative PostGIS geography while retaining old fields during migration/backfill.
- `jobs` to `work_orders`/`work_order_assignments`/`service_runs`, using a compatibility phase to avoid breaking current pages.
- `job_checklists`/`job_checklist_items` to versioned service templates and checklist responses.
- `time_entries` to or alongside `employee_work_sessions` and `employee_location_points`.
- `job_photos` to `media_assets` while preserving links to old photos.

Retire or deprecate after replacement:

- Public evidence photo bucket behavior for service records.
- Direct arbitrary job status update UI.
- Job-level mutable checklist model for completed service evidence.
- Browser-only assumptions for continuous tracking.
