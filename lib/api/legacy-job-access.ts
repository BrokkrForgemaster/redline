import { isOperationalRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/server";
import { loadAssignmentScope } from "./assignment-scope";

// Privileged legacy photo and clock paths must check current account and work scope.
export async function canWorkLegacyJob(userId: string, jobId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("role, status").eq("id", userId).single();
  if (profileError || profile?.status !== "active" || !isOperationalRole(profile.role)) return false;

  const { data: job, error: jobError } = await admin.from("jobs")
    .select("id, crew_id").eq("id", jobId).single();
  if (jobError || !job) return false;
  if (profile.role === "owner") return true;

  const { data: direct, error: directError } = await admin.from("job_assignments")
    .select("id").eq("job_id", jobId).eq("employee_id", userId).limit(1);
  if (directError) return false;
  if (direct?.length) return true;
  if (!job.crew_id) return false;
  try {
    const scope = await loadAssignmentScope(admin, userId, profile.role);
    return scope.visibleCrewIds.includes(job.crew_id);
  } catch {
    return false;
  }
}
