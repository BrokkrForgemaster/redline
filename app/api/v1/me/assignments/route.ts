import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/server";
import { isOperationalRole } from "@/lib/auth/roles";
import { loadAssignmentScope } from "@/lib/api/assignment-scope";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { data: profile, error: profileError } = await createAdminClient().from("profiles")
    .select("role, status").eq("id", auth.user.id).single();
  if (profileError || profile?.status !== "active" || !isOperationalRole(profile.role)) {
    return apiError(403, "FORBIDDEN", "Operational access is not granted.");
  }

  // Assignment aggregation crosses RLS-protected tables. The route is still
  // scoped to auth.user.id, but uses service role so crew members can see their
  // own assignments without broad client-side table access.
  const sb = createAdminClient();
  let scope: Awaited<ReturnType<typeof loadAssignmentScope>>;
  try { scope = await loadAssignmentScope(sb, auth.user.id, profile.role); }
  catch { return apiError(500, "INTERNAL_ERROR", "Could not load assignments."); }
  const assignmentFilters = [
    `employee_id.eq.${auth.user.id}`,
    ...(scope.visibleCrewIds.length ? [`crew_id.in.(${scope.visibleCrewIds.join(",")})`] : []),
    ...(scope.companyIds.length ? [`subcontractor_company_id.in.(${scope.companyIds.join(",")})`] : []),
  ];

  const { data: workOrderAssignments, error: workOrderError } = await sb
    .from("work_order_assignments")
    .select(`
      id,
      assignment_type,
      work_orders(
        id,
        work_order_number,
        title,
        status,
        scheduled_start,
        scheduled_end,
        timezone,
        instructions,
        customers(business_name),
        properties(
          id,
          property_name,
          address_line1,
          city,
          state,
          zip,
          latitude,
          longitude,
          geofence_radius_meters,
          timezone,
          access_instructions,
          service_instructions,
          safety_instructions
        )
      )
    `)
    .eq("active", true)
    .or(assignmentFilters.join(","));

  let legacyJobs: unknown[] = [];

  const directJobIdsResult = await sb
    .from("job_assignments")
    .select("job_id")
    .eq("employee_id", auth.user.id);
  if (directJobIdsResult.error) return apiError(500, "INTERNAL_ERROR", "Could not verify direct assignments.");

  const directJobIds = ((directJobIdsResult.data ?? []) as { job_id: string }[]).map(
    (row) => row.job_id
  );

  const legacyOrFilters = [
    directJobIds.length ? `id.in.(${directJobIds.join(",")})` : null,
    scope.visibleCrewIds.length ? `crew_id.in.(${scope.visibleCrewIds.join(",")})` : null,
  ].filter(Boolean);

  if (legacyOrFilters.length > 0) {
    const { data, error } = await sb
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        service_type,
        status,
        scheduled_start,
        scheduled_end,
        work_instructions,
        access_notes,
        customers(business_name),
        properties(id, property_name, address_line1, city, state, zip, latitude, longitude, access_instructions)
      `)
      .or(legacyOrFilters.join(","))
      .not("status", "in", "(cancelled,archived)")
      .order("scheduled_start", { ascending: true, nullsFirst: false });
    if (error) return apiError(500, "INTERNAL_ERROR", "Could not load assigned jobs.");
    legacyJobs = data ?? [];
  }

  const response = apiOk({
    assignments: workOrderError ? [] : workOrderAssignments ?? [],
    legacy_jobs: legacyJobs,
    warnings: workOrderError
      ? ["New work-order tables are unavailable; returning legacy job assignments only."]
      : [],
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
