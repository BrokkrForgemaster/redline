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
  const result = await client.query(`
    SELECT 'profiles' AS item, COUNT(*)::int AS count FROM profiles
    UNION ALL SELECT 'crew_members', COUNT(*)::int FROM crew_members
    UNION ALL SELECT 'job_assignments', COUNT(*)::int FROM job_assignments
    UNION ALL SELECT 'jobs_total', COUNT(*)::int FROM jobs
    UNION ALL SELECT 'jobs_today', COUNT(*)::int FROM jobs WHERE scheduled_date = CURRENT_DATE
    UNION ALL SELECT 'jobs_open', COUNT(*)::int FROM jobs WHERE status NOT IN ('cancelled','archived','completed')
    UNION ALL SELECT 'work_order_assignments', COUNT(*)::int FROM work_order_assignments
  `);

  const jobs = await client.query(`
    SELECT
      j.id,
      j.job_number,
      j.title,
      j.status,
      j.scheduled_date,
      j.crew_id,
      COUNT(DISTINCT ja.employee_id)::int AS direct_assignees
    FROM jobs j
    LEFT JOIN job_assignments ja ON ja.job_id = j.id
    WHERE j.status NOT IN ('cancelled','archived','completed')
    GROUP BY j.id
    ORDER BY j.scheduled_date NULLS LAST, j.created_at DESC
    LIMIT 20
  `);

  console.log(JSON.stringify({ counts: result.rows, open_jobs: jobs.rows }, null, 2));
} finally {
  await client.end();
}
