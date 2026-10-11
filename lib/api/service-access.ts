import { apiError } from "./errors";
import type { ApiSupabaseClient } from "./auth";

export async function requireWorkOrderAccess(
  supabase: ApiSupabaseClient,
  userId: string,
  workOrderId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: workOrder, error } = await sb
    .from("work_orders")
    .select(`
      id, work_order_number, title, status, scheduled_start, scheduled_end,
      timezone, instructions, property_id, customer_id,
      customers(id, first_name, last_name, business_name),
      properties(
        id, address_line1, city, state, zip, latitude, longitude,
        geofence_radius_meters, timezone,
        access_instructions, service_instructions, safety_instructions
      )
    `)
    .eq("id", workOrderId)
    .single();

  if (error || !workOrder) {
    return {
      ok: false as const,
      response: apiError(404, "NOT_FOUND", "Work order was not found."),
    };
  }

  const { data: directAssignment } = await sb
    .from("work_order_assignments")
    .select("id")
    .eq("work_order_id", workOrderId)
    .eq("active", true)
    .eq("assignment_type", "employee")
    .eq("employee_id", userId)
    .maybeSingle();

  const { data: crewMemberships } = await sb
    .from("crew_members")
    .select("crew_id")
    .eq("employee_id", userId);

  const crewIds = ((crewMemberships ?? []) as { crew_id: string }[]).map((r) => r.crew_id);
  let crewAssignment = null;

  if (!directAssignment && crewIds.length > 0) {
    const { data } = await sb
      .from("work_order_assignments")
      .select("id")
      .eq("work_order_id", workOrderId)
      .eq("active", true)
      .eq("assignment_type", "crew")
      .in("crew_id", crewIds)
      .maybeSingle();
    crewAssignment = data;
  }

  const { data: subMemberships } = await sb
    .from("subcontractor_memberships")
    .select("subcontractor_company_id")
    .eq("user_id", userId)
    .eq("active", true);

  const subIds = ((subMemberships ?? []) as { subcontractor_company_id: string }[]).map(
    (r) => r.subcontractor_company_id
  );
  let subAssignment = null;

  if (!directAssignment && !crewAssignment && subIds.length > 0) {
    const { data } = await sb
      .from("work_order_assignments")
      .select("id")
      .eq("work_order_id", workOrderId)
      .eq("active", true)
      .eq("assignment_type", "subcontractor")
      .in("subcontractor_company_id", subIds)
      .maybeSingle();
    subAssignment = data;
  }

  if (!directAssignment && !crewAssignment && !subAssignment) {
    return {
      ok: false as const,
      response: apiError(403, "ASSIGNMENT_REQUIRED", "You are not assigned to this work order."),
    };
  }

  return { ok: true as const, workOrder };
}

export async function requireServiceRunAccess(
  supabase: ApiSupabaseClient,
  userId: string,
  serviceRunId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: serviceRun, error } = await sb
    .from("service_runs")
    .select("id, work_order_id, status, started_at, finished_at, submitted_at, template_version_id, work_orders(property_id)")
    .eq("id", serviceRunId)
    .single();

  if (error || !serviceRun) {
    return {
      ok: false as const,
      response: apiError(404, "NOT_FOUND", "Service run was not found."),
    };
  }

  const { data: directAssignment } = await sb
    .from("work_order_assignments")
    .select("id")
    .eq("work_order_id", serviceRun.work_order_id)
    .eq("active", true)
    .eq("assignment_type", "employee")
    .eq("employee_id", userId)
    .maybeSingle();

  const { data: crewMemberships } = await sb
    .from("crew_members")
    .select("crew_id")
    .eq("employee_id", userId);

  const crewIds = ((crewMemberships ?? []) as { crew_id: string }[]).map((row) => row.crew_id);
  let crewAssignment = null;

  if (!directAssignment && crewIds.length > 0) {
    const { data } = await sb
      .from("work_order_assignments")
      .select("id")
      .eq("work_order_id", serviceRun.work_order_id)
      .eq("active", true)
      .eq("assignment_type", "crew")
      .in("crew_id", crewIds)
      .maybeSingle();

    crewAssignment = data;
  }

  const { data: subcontractorMemberships } = await sb
    .from("subcontractor_memberships")
    .select("subcontractor_company_id")
    .eq("user_id", userId)
    .eq("active", true);

  const subcontractorCompanyIds = (
    (subcontractorMemberships ?? []) as { subcontractor_company_id: string }[]
  ).map((row) => row.subcontractor_company_id);

  let subcontractorAssignment = null;
  if (!directAssignment && !crewAssignment && subcontractorCompanyIds.length > 0) {
    const { data } = await sb
      .from("work_order_assignments")
      .select("id")
      .eq("work_order_id", serviceRun.work_order_id)
      .eq("active", true)
      .eq("assignment_type", "subcontractor")
      .in("subcontractor_company_id", subcontractorCompanyIds)
      .maybeSingle();
    subcontractorAssignment = data;
  }

  if (!directAssignment && !crewAssignment && !subcontractorAssignment) {
    return {
      ok: false as const,
      response: apiError(403, "ASSIGNMENT_REQUIRED", "You are not assigned to this service run."),
    };
  }

  return { ok: true as const, serviceRun };
}
