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
    SELECT id, first_name, last_name
    FROM profiles
    WHERE status = 'active'
    ORDER BY created_at
    LIMIT 1
  `)).rows[0];
  if (!profile) throw new Error("No active profile found.");

  const crew = (await client.query(`
    INSERT INTO crews (name, description, active)
    VALUES ('Phone Test Crew', 'Crew for mobile GPS/photo workflow testing', true)
    ON CONFLICT DO NOTHING
    RETURNING id, name
  `)).rows[0] ?? (await client.query(`
    SELECT id, name
    FROM crews
    WHERE name = 'Phone Test Crew'
    LIMIT 1
  `)).rows[0];
  if (!crew) throw new Error("Could not create or find Phone Test Crew.");

  await client.query(`
    INSERT INTO crew_members (crew_id, employee_id, role)
    VALUES ($1, $2, 'leader')
    ON CONFLICT (crew_id, employee_id) DO UPDATE
    SET role = EXCLUDED.role
  `, [crew.id, profile.id]);

  await client.query(`
    UPDATE jobs
    SET crew_id = $1, updated_at = NOW()
    WHERE id = '00000800-0000-0000-0000-000000000002'
  `, [crew.id]);

  await client.query("COMMIT");

  console.log(JSON.stringify({
    crew,
    member: {
      id: profile.id,
      name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
    },
    job_id: "00000800-0000-0000-0000-000000000002",
    route: "/my-jobs/00000800-0000-0000-0000-000000000002",
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
