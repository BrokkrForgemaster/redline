import { createAdminClient } from "@/lib/supabase/server";
import { apiError } from "./errors";
import type { ApiSupabaseClient } from "./auth";
import { isOperationalRole } from "@/lib/auth/roles";

// Service-role reads require current identity and assignment checks here.
export async function requireWorkOrderAccess(
  _supabase: ApiSupabaseClient,
  userId: string,
  workOrderId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("id, role, status").eq("id", userId).single();
  if (profileError || profile?.status !== "active") {
    return { ok: false as const, response: apiError(403, "ACCOUNT_INACTIVE", "Account is not active.") };
  }
  if (!isOperationalRole(profile.role)) {
    return { ok: false as const, response: apiError(403, "FORBIDDEN", "Operational access is not granted.") };
  }

  const { data: workOrder, error } = await sb.from("work_orders")
    .select(`id, work_order_number, title, status, scheduled_start, scheduled_end,
      timezone, instructions, property_id, customer_id,
      customers(id, first_name, last_name, business_name),
      properties(id, address_line1, city, state, zip, latitude, longitude,
        geofence_radius_meters, timezone, access_instructions,
        service_instructions, safety_instructions)`)
    .eq("id", workOrderId).single();
  if (error || !workOrder) {
    return { ok: false as const, response: apiError(404, "NOT_FOUND", "Work order was not found.") };
  }
  if (profile.role === "owner") return { ok: true as const, workOrder };

  const { data: direct, error: directError } = await sb.from("work_order_assignments")
    .select("id").eq("work_order_id", workOrderId).eq("active", true)
    .eq("assignment_type", "employee").eq("employee_id", userId).limit(1);
  if (directError) return { ok: false as const, response: apiError(500, "INTERNAL_ERROR", "Could not verify assignment.") };
  if (direct?.length) return { ok: true as const, workOrder };

  const { data: memberships, error: crewError } = await sb.from("crew_members")
    .select("crew_id, crews!inner(active)").eq("employee_id", userId).eq("crews.active", true);
  if (crewError) return { ok: false as const, response: apiError(500, "INTERNAL_ERROR", "Could not verify crew membership.") };
  const crewIds = ((memberships ?? []) as { crew_id: string }[]).map(row => row.crew_id);
  if (crewIds.length) {
    const { data: crew, error: assignmentError } = await sb.from("work_order_assignments")
      .select("id").eq("work_order_id", workOrderId).eq("active", true)
      .eq("assignment_type", "crew").in("crew_id", crewIds).limit(1);
    if (assignmentError) return { ok: false as const, response: apiError(500, "INTERNAL_ERROR", "Could not verify crew assignment.") };
    if (crew?.length) return { ok: true as const, workOrder };
  }

  const { data: companies, error: companyError } = await sb.from("subcontractor_memberships")
    .select("subcontractor_company_id, subcontractor_companies!inner(status)")
    .eq("user_id", userId).eq("active", true).eq("subcontractor_companies.status", "active");
  if (companyError) return { ok: false as const, response: apiError(500, "INTERNAL_ERROR", "Could not verify company membership.") };
  const companyIds = ((companies ?? []) as { subcontractor_company_id: string }[])
    .map(row => row.subcontractor_company_id);
  if (companyIds.length) {
    const { data: company, error: assignmentError } = await sb.from("work_order_assignments")
      .select("id").eq("work_order_id", workOrderId).eq("active", true)
      .eq("assignment_type", "subcontractor").in("subcontractor_company_id", companyIds).limit(1);
    if (assignmentError) return { ok: false as const, response: apiError(500, "INTERNAL_ERROR", "Could not verify company assignment.") };
    if (company?.length) return { ok: true as const, workOrder };
  }

  return { ok: false as const, response: apiError(403, "ASSIGNMENT_REQUIRED", "You are not assigned to this work order.") };
}

export async function requireServiceRunAccess(
  supabase: ApiSupabaseClient,
  userId: string,
  serviceRunId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;
  const { data: serviceRun, error } = await sb.from("service_runs")
    .select("id, work_order_id, status, started_at, finished_at, submitted_at, template_version_id, version_number, work_orders(property_id)")
    .eq("id", serviceRunId).single();
  if (error || !serviceRun) {
    return { ok: false as const, response: apiError(404, "NOT_FOUND", "Service run was not found.") };
  }
  const access = await requireWorkOrderAccess(supabase, userId, serviceRun.work_order_id);
  if (!access.ok) return access;
  return { ok: true as const, serviceRun };
}
