import { readFile } from "node:fs/promises";
import { Client } from "pg";

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

  const profileResult = await client.query(`
    SELECT id, first_name, last_name, role
    FROM profiles
    WHERE status = 'active'
    ORDER BY created_at
    LIMIT 1
  `);
  if (profileResult.rowCount === 0) throw new Error("No active profile found.");
  const profile = profileResult.rows[0];

  const jobResult = await client.query(`
    SELECT id, job_number, title
    FROM jobs
    WHERE status NOT IN ('cancelled','archived','completed')
    ORDER BY
      CASE WHEN status = 'scheduled' THEN 0 ELSE 1 END,
      scheduled_date NULLS LAST,
      created_at DESC
    LIMIT 1
  `);
  if (jobResult.rowCount === 0) throw new Error("No open job found.");
  const job = jobResult.rows[0];

  const today = new Date().toISOString().slice(0, 10);
  await client.query(
    `
      UPDATE jobs
      SET
        scheduled_date = $1::date,
        scheduled_start = ($1::date + TIME '09:00') AT TIME ZONE 'America/New_York',
        scheduled_end = ($1::date + TIME '10:00') AT TIME ZONE 'America/New_York',
        status = CASE WHEN status = 'approved' THEN 'scheduled'::job_status ELSE status END,
        updated_at = NOW()
      WHERE id = $2
    `,
    [today, job.id],
  );

  await client.query(
    `
      INSERT INTO job_assignments (job_id, employee_id, role)
      VALUES ($1, $2, 'leader')
      ON CONFLICT (job_id, employee_id) DO UPDATE
      SET role = EXCLUDED.role
    `,
    [job.id, profile.id],
  );

  await client.query("COMMIT");

  console.log(JSON.stringify({
    assigned_to: {
      id: profile.id,
      name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
      role: profile.role,
    },
    job: {
      id: job.id,
      job_number: job.job_number,
      title: job.title,
      route: `/my-jobs/${job.id}`,
      scheduled_date: today,
    },
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
