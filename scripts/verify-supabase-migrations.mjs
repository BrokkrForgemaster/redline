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
  const checks = await client.query(`
    SELECT
      to_regclass('public.job_photos') IS NOT NULL AS job_photos,
      to_regclass('public.job_location_tags') IS NOT NULL AS job_location_tags,
      to_regclass('public.work_orders') IS NOT NULL AS work_orders,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'job_photos'
          AND column_name = 'latitude'
      ) AS job_photos_latitude,
      EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'job-photos'
      ) AS job_photos_bucket,
      EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'service-evidence'
      ) AS service_evidence_bucket,
      EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'service-reports'
      ) AS service_reports_bucket
  `);

  const versions = await client.query(`
    SELECT version
    FROM supabase_migrations.schema_migrations
    WHERE version IN ('006','007','008','009','010','011','012')
    ORDER BY version
  `);

  console.log(JSON.stringify({ checks: checks.rows[0], versions: versions.rows }, null, 2));
} finally {
  await client.end();
}
