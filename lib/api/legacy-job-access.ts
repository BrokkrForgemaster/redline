import { isOperationalRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/server";

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

  const { data: crew, error: crewError } = await admin.from("crews")
    .select("active").eq("id", job.crew_id).single();
  if (crewError || !crew?.active) return false;
  const { data: member, error: memberError } = await admin.from("crew_members")
    .select("id").eq("crew_id", job.crew_id).eq("employee_id", userId).limit(1);
  return !memberError && !!member?.length;
}
