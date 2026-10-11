import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

function loadEnv(text) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

await loadEnv(await readFile(".env.local", "utf8"));

const email = "testuser@test.com";
const testJobIds = [
  "00000800-0000-0000-0000-000000000002",
  "55c200ac-085f-4923-8c8f-8ddb4cf9ea56",
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const client = new Client({
  host: "aws-1-us-east-2.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: `postgres.${projectRef}`,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

await client.connect();
try {
  await client.query("BEGIN");

  const profile = (await client.query(
    `
      SELECT id, first_name, last_name, email
      FROM profiles
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [email],
  )).rows[0];
  if (!profile) throw new Error(`No profile found for ${email}.`);

  const jobs = await client.query(
    `
      SELECT id, job_number, title, status
      FROM jobs
      WHERE id = ANY($1::uuid[])
      ORDER BY scheduled_date, created_at
    `,
    [testJobIds],
  );
  if (jobs.rowCount !== testJobIds.length) {
    throw new Error(`Expected ${testJobIds.length} test jobs, found ${jobs.rowCount}.`);
  }

  const photos = await client.query(
    `
      SELECT storage_path
      FROM job_photos
      WHERE job_id = ANY($1::uuid[])
    `,
    [testJobIds],
  );
  const storagePaths = photos.rows.map((row) => row.storage_path).filter(Boolean);

  await client.query(
    `
      DELETE FROM job_location_tags
      WHERE job_id = ANY($1::uuid[])
    `,
    [testJobIds],
  );

  await client.query(
    `
      DELETE FROM job_photos
      WHERE job_id = ANY($1::uuid[])
    `,
    [testJobIds],
  );

  await client.query(
    `
      DELETE FROM time_entries
      WHERE job_id = ANY($1::uuid[])
        AND employee_id = $2
    `,
    [testJobIds, profile.id],
  );

  await client.query(
    `
      UPDATE jobs
      SET status = 'scheduled'::job_status,
          scheduled_date = CURRENT_DATE,
          scheduled_start = (CURRENT_DATE + TIME '09:00') AT TIME ZONE 'America/New_York',
          scheduled_end = (CURRENT_DATE + TIME '10:00') AT TIME ZONE 'America/New_York',
          updated_at = NOW()
      WHERE id = ANY($1::uuid[])
    `,
    [testJobIds],
  );

  for (const jobId of testJobIds) {
    await client.query(
      `
        INSERT INTO job_assignments (job_id, employee_id, role)
        VALUES ($1, $2, 'leader')
        ON CONFLICT (job_id, employee_id) DO UPDATE
        SET role = EXCLUDED.role
      `,
      [jobId, profile.id],
    );
  }

  await client.query("COMMIT");

  if (storagePaths.length > 0) {
    const { error } = await supabase.storage.from("job-photos").remove(storagePaths);
    if (error) {
      console.warn(`Warning: reset database, but failed to remove stored photo objects: ${error.message}`);
    }
  }

  console.log(JSON.stringify({
    reset_for: {
      id: profile.id,
      email: profile.email,
      name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
    },
    jobs: jobs.rows.map((job) => ({
      id: job.id,
      job_number: job.job_number,
      title: job.title,
      previous_status: job.status,
      route: `/my-jobs/${job.id}`,
    })),
    removed_photo_objects: storagePaths.length,
    scheduled_date: new Date().toISOString().slice(0, 10),
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
