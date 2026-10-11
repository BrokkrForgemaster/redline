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
const password = "TestUser123!";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const list = await supabase.auth.admin.listUsers();
if (list.error) throw list.error;

let authUser = list.data.users.find((user) => user.email?.toLowerCase() === email);
if (!authUser) {
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: "Test",
      last_name: "User",
      role: "crew_member",
    },
  });
  if (created.error) throw created.error;
  authUser = created.data.user;
} else {
  const updated = await supabase.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...(authUser.user_metadata ?? {}),
      first_name: "Test",
      last_name: "User",
      role: "crew_member",
    },
  });
  if (updated.error) throw updated.error;
}

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

  await client.query(`
    INSERT INTO profiles (id, first_name, last_name, email, role, status)
    VALUES ($1, 'Test', 'User', $2, 'crew_member', 'active')
    ON CONFLICT (id) DO UPDATE
    SET first_name = 'Test',
        last_name = 'User',
        email = EXCLUDED.email,
        role = 'crew_member',
        status = 'active',
        updated_at = NOW()
  `, [authUser.id, email]);

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
  `, [crew.id, authUser.id]);

  const job = (await client.query(`
    SELECT id, job_number, title
    FROM jobs
    WHERE title = 'Phone Test Mow - October 9'
      AND scheduled_date = date '2026-10-09'
    ORDER BY created_at DESC
    LIMIT 1
  `)).rows[0];
  if (!job) throw new Error("October 9 phone test job was not found.");

  await client.query(`
    UPDATE jobs
    SET crew_id = $1,
        status = 'scheduled'::job_status,
        scheduled_date = date '2026-10-09',
        updated_at = NOW()
    WHERE id = $2
  `, [crew.id, job.id]);

  await client.query(`
    INSERT INTO job_assignments (job_id, employee_id, role)
    VALUES ($1, $2, 'leader')
    ON CONFLICT (job_id, employee_id) DO UPDATE SET role = EXCLUDED.role
  `, [job.id, authUser.id]);

  await client.query("COMMIT");

  console.log(JSON.stringify({
    login: { email, password },
    user_id: authUser.id,
    crew_id: crew.id,
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
