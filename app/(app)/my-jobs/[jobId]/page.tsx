import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import FieldJobView from "./FieldJobView";
import JobsLiveRefresh from "@/components/app/JobsLiveRefresh";

export default async function FieldJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const today = new Date().toISOString().split("T")[0];

  const { data: job } = await sb
    .from("jobs")
    .select(`
      id, job_number, title, service_type, status,
      scheduled_start, actual_start, actual_end, work_instructions, access_notes,
      customers(business_name),
      properties(address_line1, city, state)
    `)
    .eq("id", jobId)
    .single();

  if (!job) notFound();
  const { data: businessName, error: businessError } = await sb.rpc("assigned_legacy_business_name", {
    p_job_id: jobId,
  });
  if (businessError || typeof businessName !== "string") notFound();
  job.customers = { business_name: businessName };

  // Active (open) time entry for this employee on this job
  const { data: activeEntry } = await sb
    .from("time_entries")
    .select("id, clock_in")
    .eq("job_id", jobId)
    .eq("employee_id", user.id)
    .is("clock_out", null)
    .maybeSingle();

  // Most recent completed entry today
  const { data: completedEntry } = await sb
    .from("time_entries")
    .select("id, clock_in, clock_out, total_minutes")
    .eq("job_id", jobId)
    .eq("employee_id", user.id)
    .not("clock_out", "is", null)
    .gte("clock_in", `${today}T00:00:00`)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Photo counts and manually tagged job location
  const [{ count: beforeCount }, { count: afterCount }, { count: manualLocationTagCount }] = await Promise.all([
    sb.from("job_photos").select("id", { count: "exact", head: true })
      .eq("job_id", jobId).eq("employee_id", user.id).eq("photo_type", "before"),
    sb.from("job_photos").select("id", { count: "exact", head: true })
      .eq("job_id", jobId).eq("employee_id", user.id).eq("photo_type", "after"),
    sb.from("job_location_tags").select("id", { count: "exact", head: true })
      .eq("job_id", jobId).eq("employee_id", user.id).eq("tag_type", "manual"),
  ]);

  return (
    <>
      <JobsLiveRefresh />
      <FieldJobView
        job={job}
        activeEntry={activeEntry ?? null}
        completedEntry={completedEntry ?? null}
        beforeCount={beforeCount ?? 0}
        afterCount={afterCount ?? 0}
        locationTagged={!!manualLocationTagCount}
      />
    </>
  );
}
