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

  const profile = (await client.query(`
    SELECT id
    FROM profiles
    WHERE status = 'active'
    ORDER BY created_at
    LIMIT 1
  `)).rows[0];
  if (!profile) throw new Error("No active profile found.");

  const crew = (await client.query(`
    SELECT id FROM crews WHERE name = 'Phone Test Crew' LIMIT 1
  `)).rows[0] ?? (await client.query(`
    INSERT INTO crews (name, description, active)
    VALUES ('Phone Test Crew', 'Crew for mobile GPS/photo workflow testing', true)
    RETURNING id
  `)).rows[0];

  await client.query(`
    INSERT INTO crew_members (crew_id, employee_id, role)
    VALUES ($1, $2, 'leader')
    ON CONFLICT (crew_id, employee_id) DO UPDATE SET role = EXCLUDED.role
  `, [crew.id, profile.id]);

  const customer = (await client.query(`
    INSERT INTO customers (
      account_type,
      first_name,
      last_name,
      business_name,
      email,
      mobile_phone,
      status,
      created_by
    )
    VALUES (
      'individual',
      'October',
      'Nine',
      NULL,
      'october9.test@example.com',
      '555-0109',
      'active',
      $1
    )
    RETURNING id, first_name, last_name
  `, [profile.id])).rows[0];

  const property = (await client.query(`
    INSERT INTO properties (
      customer_id,
      property_name,
      address_line1,
      city,
      state,
      zip,
      property_type,
      latitude,
      longitude,
      access_instructions,
      created_by
    )
    VALUES (
      $1,
      'October 9 Test Property',
      '109 Test Site Lane',
      'Somerset',
      'KY',
      '42501',
      'residential',
      37.0920,
      -84.6041,
      'Phone workflow test property.',
      $2
    )
    RETURNING id, property_name
  `, [customer.id, profile.id])).rows[0];

  const job = (await client.query(`
    INSERT INTO jobs (
      job_number,
      customer_id,
      property_id,
      service_type,
      priority,
      status,
      title,
      description,
      crew_id,
      scheduled_date,
      scheduled_start,
      scheduled_end,
      estimated_hours,
      work_instructions,
      access_notes,
      created_by
    )
    VALUES (
      'JOB-TEST-OCT09-' || to_char(now(), 'HH24MISS'),
      $1,
      $2,
      'lawn_mowing',
      'normal',
      'scheduled',
      'Phone Test Mow - October 9',
      'Test job for phone GPS and before/after photo workflow.',
      $3,
      date '2026-10-09',
      (date '2026-10-09' + time '09:00') at time zone 'America/New_York',
      (date '2026-10-09' + time '10:00') at time zone 'America/New_York',
      1,
      'Use this job to test GPS tagging and before/after photo upload from a phone.',
      'This is a test job for October 9.',
      $4
    )
    RETURNING id, job_number, title
  `, [customer.id, property.id, crew.id, profile.id])).rows[0];

  await client.query(`
    INSERT INTO job_assignments (job_id, employee_id, role)
    VALUES ($1, $2, 'leader')
    ON CONFLICT (job_id, employee_id) DO UPDATE SET role = EXCLUDED.role
  `, [job.id, profile.id]);

  await client.query("COMMIT");

  console.log(JSON.stringify({
    customer,
    property,
    job: {
      ...job,
      scheduled_date: "2026-10-09",
      route: `/my-jobs/${job.id}`,
    },
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
