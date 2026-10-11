# Stage 08 Progress

## What Changed

### Direct Work Order Endpoint (replaces assignment scan)
- Added `requireWorkOrderAccess` to `lib/api/service-access.ts` — checks direct employee, crew, or subcontractor assignment; returns the full work order detail with customers and property data.
- Added `GET /api/v1/work-orders/:id` — assignment-gated endpoint returning the work order. Used by the run page.
- Updated `app/(app)/my-jobs/run/[workOrderId]/page.tsx` `loadWorkOrder` to call `GET /api/v1/work-orders/:id` directly instead of fetching all assignments and filtering client-side. Faster and eliminates the unnecessary `WorkOrderAssignment` import.

### Location Events in Admin Detail
- Updated `GET /api/v1/service-runs/:id` to query `location_events` (event type, geofence result, distance, radius, accuracy, override reason, device timestamp) in parallel with the existing media/notes/events queries.
- Also queries `report_versions` for the latest report (if any), generates a 15-min signed URL, and returns `report` alongside `location_events`.
- Added `GeofenceTimeline` component to the admin detail page — renders each location event as a row with event label (Start / Finish / Override), a colour-coded result badge (on site / near / outside / override), distance from site, and device timestamp. Displayed when at least one location event exists.
- Added report download section: shows a "Download PDF" button if a signed report URL is available, or a "not yet available" placeholder.

### PDF Report Generation on Approve
- Added `createAdminClient()` to `lib/supabase/server.ts` — service-role client that bypasses RLS, used only for server-side storage writes.
- Created `lib/reports/serviceRunPdf.tsx` — `@react-pdf/renderer` document template with: header, approval banner, job details, time on site, location verification section (start/finish geofence summary with result pills), photo evidence counts, instructions, and field notes. Footer includes run ID and generation date. Generates a US Letter PDF.
- Updated `POST /api/v1/service-runs/:id/approve`:
  1. Approves the run (status → completed, sets frozen_at).
  2. Fetches media counts, notes, location events, and approver name.
  3. Determines next `version_number` from `report_versions`.
  4. Renders the PDF with `renderServiceRunPdf`.
  5. Computes SHA-256 hash of the buffer.
  6. Uploads to `service-reports` bucket via service-role client.
  7. Inserts a `report_versions` row.
  8. Returns a 15-min signed URL as `report_url` in the response.
  - PDF generation is best-effort: if it fails, the approval itself has already succeeded and the error is swallowed. The detail page will show "not yet available" for the report.
- Toast on the approve action now reads "Approved — report generated." when a report URL is returned.

## Files Added / Modified

- `lib/supabase/server.ts` — added `createAdminClient()`
- `lib/api/service-access.ts` — added `requireWorkOrderAccess`
- `app/api/v1/work-orders/[id]/route.ts` — new GET endpoint
- `app/api/v1/service-runs/[id]/route.ts` — added `location_events` and `report` to response
- `app/api/v1/service-runs/[id]/approve/route.ts` — PDF generation + report_versions insert
- `lib/reports/serviceRunPdf.tsx` — new PDF template
- `app/(app)/my-jobs/run/[workOrderId]/page.tsx` — loadWorkOrder uses direct endpoint
- `app/(app)/service-runs/[id]/page.tsx` — GeofenceTimeline + report download

## Tests

- 4 test files, 12 tests — all pass.
- `npx tsc --noEmit` — clean.

## Prerequisites Before Testing End-to-End

- **Run migrations 007 through 011** against your Supabase instance. Migration `011_service_storage_buckets.sql` creates the private `service-evidence` and `service-reports` buckets.
- **Set `SUPABASE_SERVICE_ROLE_KEY`** in your `.env.local` (server-side only, never expose to client). Used only by `createAdminClient()` in the approve endpoint for PDF upload.

## Rollback Notes

- `GET /api/v1/work-orders/:id` is additive; the `/api/v1/me/assignments` endpoint still exists.
- If the run page breaks (e.g. assignment check fails), temporarily revert `loadWorkOrder` to the assignments scan.
- PDF generation failure does not block approval; `report_versions` rows can be manually deleted if needed.

## Next Stage

- Validate end-to-end on staging (migrations + buckets + run flow + admin review + PDF download).
- Add `GET /api/v1/service-runs/:id/report` to re-generate or re-sign the report URL without re-approving.
- Add `snow_service_details` form to the run page (snow vertical slice).
- Add `checklist_responses` to service runs with a template-driven checklist UI.
- Implement `employee_work_sessions` clock-in / clock-out tied to the run start/finish.
