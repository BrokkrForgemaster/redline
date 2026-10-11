import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

const from = Number.parseInt(process.argv[2] ?? "1", 10);
const to = Number.parseInt(process.argv[3] ?? "999", 10);

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

function projectRefFromUrl(url) {
  const host = new URL(url).hostname;
  return host.split(".")[0];
}

function parseMigrationName(file) {
  const match = file.match(/^(\d+)_([^.]+)\.sql$/);
  if (!match) throw new Error(`Unexpected migration filename: ${file}`);
  return { version: match[1], name: match[2] };
}

await loadEnv(await readFile(".env.local", "utf8"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const password = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !password) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD are required in .env.local");
}

const projectRef = projectRefFromUrl(supabaseUrl);
const connectionCandidates = [
  {
    label: "direct",
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    user: "postgres",
  },
  ...[
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "ca-central-1",
    "eu-west-1",
    "eu-west-2",
    "eu-central-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "ap-south-1",
    "sa-east-1",
  ].flatMap((region) => [0, 1].map((generation) => ({
    label: `pooler aws-${generation}-${region}`,
    host: `aws-${generation}-${region}.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${projectRef}`,
  }))),
];

const migrations = [
  "001_initial_schema.sql",
  "002_rls_policies.sql",
  "003_permissions_seed.sql",
  "004_gallery_storage.sql",
  "005_avatars_storage.sql",
  "006_job_photos.sql",
  "007_field_service_foundation.sql",
  "008_geofence_distance_function.sql",
  "009_service_template_seed.sql",
  "010_snow_details_temperature.sql",
  "011_service_storage_buckets.sql",
  "012_job_location_tags.sql",
  "013_fix_time_entries_update_policy.sql",
  "014_privileged_user_roles.sql",
  "015_profile_names_from_login.sql",
  "016_add_developer_role.sql",
  "017_developer_role_and_owner_fix.sql",
].filter((file) => {
  const n = Number.parseInt(file.slice(0, 3), 10);
  return n >= from && n <= to;
});

let client;
let lastConnectionError;
for (const candidate of connectionCandidates) {
  const candidateClient = new Client({
    host: candidate.host,
    port: candidate.port,
    database: "postgres",
    user: candidate.user,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 7000,
  });
  candidateClient.on("error", () => {});

  try {
    await candidateClient.connect();
    client = candidateClient;
    console.log(`connected via ${candidate.label}`);
    break;
  } catch (error) {
    lastConnectionError = error;
    await candidateClient.end().catch(() => {});
  }
}

if (!client) {
  throw lastConnectionError ?? new Error("Unable to connect to Supabase Postgres");
}

try {
  await client.query("CREATE SCHEMA IF NOT EXISTS supabase_migrations");
  await client.query(`
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      statements text[],
      name text
    )
  `);

  for (const file of migrations) {
    const { version, name } = parseMigrationName(file);
    const existing = await client.query(
      "SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1",
      [version],
    );

    if (existing.rowCount > 0) {
      console.log(`skip ${file} (already recorded)`);
      continue;
    }

    console.log(`apply ${file}`);
    const sql = await readFile(join("supabase", "migrations", file), "utf8");

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO supabase_migrations.schema_migrations(version, statements, name) VALUES ($1, $2, $3)",
        [version, [sql], name],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
