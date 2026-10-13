import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/errors";
import { isOperationalRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/server";

const MAX_MONTH_ITEMS = 1000;

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return apiError(400, "VALIDATION_ERROR", "A valid calendar month is required.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  if (year < 2000 || year > 2100) return apiError(400, "VALIDATION_ERROR", "Calendar month is out of range.");

  const sb = createAdminClient();
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("role, status").eq("id", auth.user.id).single();
  if (profileError || profile?.status !== "active" || !isOperationalRole(profile.role)) {
    return apiError(403, "FORBIDDEN", "Calendar access is not granted.");
  }

  let allowedIds: string[] | null = null;
  let crewIds: string[] = [];
  if (profile.role !== "owner") {
    const [{ data: crews, error: crewError }, { data: companies, error: companyError }] = await Promise.all([
      sb.from("crew_members").select("crew_id, crews!inner(active)")
        .eq("employee_id", auth.user.id).eq("crews.active", true),
      sb.from("subcontractor_memberships")
        .select("subcontractor_company_id, subcontractor_companies!inner(status)")
        .eq("user_id", auth.user.id).eq("active", true).eq("subcontractor_companies.status", "active"),
    ]);
    if (crewError || companyError) return apiError(500, "INTERNAL_ERROR", "Could not verify calendar scope.");
    crewIds = ((crews ?? []) as { crew_id: string }[]).map(row => row.crew_id);
    const companyIds = ((companies ?? []) as { subcontractor_company_id: string }[]).map(row => row.subcontractor_company_id);
    const filters = [
      `employee_id.eq.${auth.user.id}`,
      ...(crewIds.length ? [`crew_id.in.(${crewIds.join(",")})`] : []),
      ...(companyIds.length ? [`subcontractor_company_id.in.(${companyIds.join(",")})`] : []),
    ];
    const { data: assignments, error: assignmentError } = await sb.from("work_order_assignments")
      .select("work_order_id").eq("active", true).or(filters.join(","));
    if (assignmentError) return apiError(500, "INTERNAL_ERROR", "Could not load calendar assignments.");
    allowedIds = [...new Set(((assignments ?? []) as { work_order_id: string }[]).map(row => row.work_order_id))];
    if (allowedIds.length > MAX_MONTH_ITEMS) return apiError(409, "VALIDATION_ERROR", "Too many assignments for this calendar view.");
  }

  // Include adjacent UTC days because local business days may straddle UTC dates.
  const start = new Date(Date.UTC(year, monthNumber - 1, -1)).toISOString();
  const end = new Date(Date.UTC(year, monthNumber, 3)).toISOString();
  const canonicalResult = allowedIds?.length === 0
    ? { data: [], error: null }
    : await (() => {
      let query = sb.from("work_orders")
        .select("id, title, status, scheduled_start, scheduled_end, timezone, customers(first_name, last_name)")
        .gte("scheduled_start", start).lt("scheduled_start", end)
        .order("scheduled_start", { ascending: true }).limit(MAX_MONTH_ITEMS + 1);
      if (allowedIds) query = query.in("id", allowedIds);
      return query;
    })();
  const { data, error } = canonicalResult;
  if (error) return apiError(500, "INTERNAL_ERROR", "Calendar could not be refreshed.");
  if ((data?.length ?? 0) > MAX_MONTH_ITEMS) {
    return apiError(409, "VALIDATION_ERROR", "Calendar has too many entries; use a narrower view.");
  }
  const firstDay = `${month}-01`;
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  let legacyIds: string[] | null = null;
  if (profile.role !== "owner") {
    const { data: direct, error: directError } = await sb.from("job_assignments")
      .select("job_id").eq("employee_id", auth.user.id);
    if (directError) return apiError(500, "INTERNAL_ERROR", "Could not verify legacy assignments.");
    const directIds = ((direct ?? []) as { job_id: string }[]).map(row => row.job_id);
    const filters = [
      ...(directIds.length ? [`id.in.(${directIds.join(",")})`] : []),
      ...(crewIds.length ? [`crew_id.in.(${crewIds.join(",")})`] : []),
    ];
    if (filters.length === 0) legacyIds = [];
    else {
      const { data: assigned, error: assignedError } = await sb.from("jobs")
        .select("id").or(filters.join(","));
      if (assignedError) return apiError(500, "INTERNAL_ERROR", "Could not verify legacy calendar scope.");
      legacyIds = ((assigned ?? []) as { id: string }[]).map(row => row.id);
    }
    if (legacyIds.length > MAX_MONTH_ITEMS) return apiError(409, "VALIDATION_ERROR", "Too many legacy assignments for this calendar view.");
  }

  const legacyResult = legacyIds?.length === 0
    ? { data: [], error: null }
    : await (() => {
      let query = sb.from("jobs")
        .select("id, title, status, scheduled_date, scheduled_start, scheduled_end, customers(first_name, last_name), properties(timezone)")
        .gte("scheduled_date", firstDay).lt("scheduled_date", nextMonth)
        .not("status", "in", "(cancelled,archived)")
        .order("scheduled_date", { ascending: true }).limit(MAX_MONTH_ITEMS + 1);
      if (legacyIds) query = query.in("id", legacyIds);
      return query;
    })();
  if (legacyResult.error) return apiError(500, "INTERNAL_ERROR", "Legacy calendar could not be refreshed.");
  const legacyJobs = legacyResult.data ?? [];
  if (legacyJobs.length > MAX_MONTH_ITEMS) return apiError(409, "VALIDATION_ERROR", "Calendar has too many legacy entries.");
  const candidateIds = legacyJobs.map(row => row.id);
  const mappedResult = candidateIds.length
    ? await sb.from("work_orders").select("legacy_job_id").in("legacy_job_id", candidateIds)
    : { data: [], error: null };
  if (mappedResult.error) return apiError(500, "INTERNAL_ERROR", "Could not reconcile legacy jobs.");
  const mappedIds = new Set(((mappedResult.data ?? []) as { legacy_job_id: string | null }[]).map(row => row.legacy_job_id));
  return apiOk({ events: data ?? [], legacy_jobs: legacyJobs.filter(row => !mappedIds.has(row.id)) });
}
