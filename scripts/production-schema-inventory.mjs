// Read-only production schema inventory. This file has no apply mode.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { inspectStaging } from './staging-migration-preflight.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.local');

try {
  if (!existsSync(envFile)) throw new Error('.env.local is missing.');
  process.loadEnvFile(envFile);
  const connectionString = process.env.REDLINE_DATABASE_URL;
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!connectionString || !apiUrl) throw new Error('Database or public project URL is missing.');
  const db = new URL(connectionString);
  const api = new URL(apiUrl);
  const apiRef = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  const dbRef = db.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ??
    decodeURIComponent(db.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
  if (!apiRef || dbRef !== apiRef) throw new Error('Database URL does not match the configured application project.');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
    query_timeout: 20000, statement_timeout: 20000 });
  await client.connect();
  try {
    const report = await inspectStaging(client);
    await client.query('BEGIN READ ONLY');
    let deployed;
    try {
      const migrations = await client.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version');
      const roles = await client.query(`SELECT role::text AS role, status::text AS status, count(*)::int AS count
        FROM public.profiles GROUP BY role, status ORDER BY role, status`);
      const buckets = await client.query(`SELECT id, public, file_size_limit, allowed_mime_types
        FROM storage.buckets WHERE id IN ('gallery', 'avatars', 'job-photos', 'service-evidence') ORDER BY id`);
      const policies = await client.query(`SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies WHERE (schemaname = 'storage' AND tablename = 'objects')
          OR (schemaname = 'public' AND tablename IN
            ('profiles', 'jobs', 'time_entries', 'notifications', 'gallery_images'))
        ORDER BY schemaname, tablename, policyname`);
      const realtime = await client.query(`SELECT tablename FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
          AND tablename IN ('notifications', 'jobs', 'time_entries') ORDER BY tablename`);
      const retainedCounts = await client.query(`
        SELECT 'customers' AS entity, count(*)::int AS count FROM public.customers
        UNION ALL SELECT 'properties', count(*)::int FROM public.properties
        UNION ALL SELECT 'jobs', count(*)::int FROM public.jobs
        UNION ALL SELECT 'job_photos', count(*)::int FROM public.job_photos
        UNION ALL SELECT 'work_orders', count(*)::int FROM public.work_orders
        UNION ALL SELECT 'service_runs', count(*)::int FROM public.service_runs
        UNION ALL SELECT 'media_assets', count(*)::int FROM public.media_assets
        UNION ALL SELECT 'notifications', count(*)::int FROM public.notifications`);
      const objectCounts = await client.query(`SELECT bucket_id, count(*)::int AS count
        FROM storage.objects WHERE bucket_id IN
          ('service-evidence', 'job-photos', 'gallery', 'avatars', 'service-reports')
        GROUP BY bucket_id ORDER BY bucket_id`);
      const missingObjects = await client.query(`
        SELECT (SELECT count(*)::int FROM public.job_photos p
          LEFT JOIN storage.objects o ON o.bucket_id = 'job-photos' AND o.name = p.storage_path
          WHERE o.id IS NULL) AS legacy_photo_rows_without_objects,
          (SELECT count(*)::int FROM public.media_assets m
          LEFT JOIN storage.objects o ON o.bucket_id = m.bucket AND o.name = m.object_key
          WHERE m.status IN ('attached', 'finalized') AND o.id IS NULL) AS attached_media_rows_without_objects`);
      deployed = {
        appliedVersions: migrations.rows.map(row => row.version),
        profileRoleCounts: roles.rows,
        storageBuckets: buckets.rows,
        selectedPolicies: policies.rows,
        realtimeTables: realtime.rows.map(row => row.tablename),
        retainedCounts: retainedCounts.rows,
        objectCounts: objectCounts.rows,
        missingObjects: missingObjects.rows[0],
      };
    } finally {
      await client.query('ROLLBACK');
    }
    console.log(JSON.stringify({ projectRef: apiRef, ...report, deployed }, null, 2));
  } finally {
    await client.end();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Production inventory failed.');
  process.exitCode = 1;
}
