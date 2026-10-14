// Guarded direct-production rehearsal/application for the additive operations
// migrations. Never use a blanket db push against this project's history gaps.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
const mode = process.argv[2];
if (!['dry-run', 'apply'].includes(mode)) {
  throw new Error('Usage: node scripts/apply-production-operations-043-044.mjs <dry-run|apply>');
}
const connectionString = process.env.REDLINE_DATABASE_URL;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!connectionString || !apiUrl) throw new Error('Production connection settings are missing.');
const dbUrl = new URL(connectionString);
const api = new URL(apiUrl);
const projectRef = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const dbRef = dbUrl.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ??
  decodeURIComponent(dbUrl.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
if (projectRef !== 'vcjjkaompuriaqybjygm' || dbRef !== projectRef) {
  throw new Error('Production project guard failed.');
}

const backupRoot = path.join(root, '.redline-backups');
const newest = existsSync(backupRoot) ? readdirSync(backupRoot).sort().at(-1) : null;
if (!newest) throw new Error('A fresh database and object snapshot is required.');
const backupPath = path.join(backupRoot, newest);
const manifest = JSON.parse(readFileSync(path.join(backupPath, 'manifest.json'), 'utf8'));
const checksum = bytes => createHash('sha256').update(bytes).digest('hex');
const age = Date.now() - new Date(manifest.capturedAt).getTime();
if (manifest.projectRef !== projectRef || !Number.isFinite(age) || age < 0 || age > 2 * 60 * 60 * 1000 ||
    manifest.database?.sha256 !== checksum(readFileSync(path.join(backupPath, 'database.dump'))) ||
    !Array.isArray(manifest.objects) ||
    manifest.objects.some(object => object.sha256 !== checksum(readFileSync(path.join(backupPath, object.file))))) {
  throw new Error('Snapshot project, checksum, or freshness verification failed.');
}

const versions = ['043', '044'];
const sources = versions.map(version => {
  const matches = readdirSync(path.join(root, 'supabase/migrations'))
    .filter(file => file.startsWith(`${version}_`) && file.endsWith('.sql'));
  if (matches.length !== 1) throw new Error(`Expected one SQL file for migration ${version}.`);
  return { version, name: matches[0].slice(4, -4), sql: readFileSync(path.join(root, 'supabase/migrations', matches[0]), 'utf8'),
    sha256: checksum(readFileSync(path.join(root, 'supabase/migrations', matches[0]))) };
});

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
  query_timeout: 60000, statement_timeout: 60000 });
await client.connect();
try {
  await client.query('BEGIN');
  let committed = false;
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    const lock = await client.query("SELECT pg_try_advisory_xact_lock(hashtext('redline:production-migration')) AS held");
    if (!lock.rows[0].held) throw new Error('Another production migration is in progress.');
    const history = (await client.query(`SELECT version FROM supabase_migrations.schema_migrations
      WHERE version IN ('039','041','042','043','044') ORDER BY version`)).rows.map(row => row.version);
    if (history.join(',') !== '039,041,042') throw new Error('Deployed migration history differs from the reviewed 042 baseline.');
    if (!manifest.migrations?.includes('042') || manifest.migrations.includes('043') || manifest.migrations.includes('044')) {
      throw new Error('Backup migration history is not the expected pre-043 baseline.');
    }
    const before = (await client.query(`SELECT
      (SELECT count(*)::int FROM public.crews) AS crews,
      (SELECT count(*)::int FROM public.crew_members) AS crew_members,
      (SELECT count(*)::int FROM public.time_entries) AS time_entries,
      (SELECT count(*)::int FROM public.customers) AS customers,
      (SELECT count(*)::int FROM storage.objects) AS objects,
      (SELECT count(*)::int FROM public.profiles WHERE role='owner' AND status='active') AS owners,
      (SELECT count(*)::int FROM public.time_entries WHERE clock_out IS NULL) AS open_entries`)).rows[0];
    if (before.owners !== 1 || before.objects !== manifest.objects.length) {
      throw new Error('Owner count or object count differs from backup.');
    }
    const duplicates = (await client.query(`SELECT count(*)::int AS count FROM (
      SELECT employee_id FROM public.time_entries WHERE clock_out IS NULL
      GROUP BY employee_id HAVING count(*) > 1) conflicts`)).rows[0].count;
    if (duplicates !== 0) throw new Error('Existing employees have multiple open time entries. Reconcile before migration.');

    for (const source of sources) {
      await client.query(source.sql);
      if (mode === 'apply') {
        await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ($1,$2)',
          [source.version, source.name]);
      }
    }
    const after = (await client.query(`SELECT
      (SELECT count(*)::int FROM public.crews) AS crews,
      (SELECT count(*)::int FROM public.crew_members) AS crew_members,
      (SELECT count(*)::int FROM public.time_entries) AS time_entries,
      (SELECT count(*)::int FROM public.customers) AS customers,
      (SELECT count(*)::int FROM storage.objects) AS objects,
      (SELECT count(*)::int FROM public.profiles WHERE role='owner' AND status='active') AS owners,
      (SELECT count(*)::int FROM public.time_entries WHERE clock_out IS NULL) AS open_entries`)).rows[0];
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Retained row counts changed during migration.');
    const check = (await client.query(`SELECT
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
        AND table_name='crews' AND column_name='subcontractor_company_id') AS company_crews,
      to_regprocedure('public.manage_subcontractor_company(text,uuid,jsonb)') IS NOT NULL AS company_command,
      to_regclass('public.time_entries_one_open_per_employee') IS NOT NULL AS unique_open_entry,
      EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='time_entries'
        AND policyname='Active staff can clock in personally') AS staff_clock_policy`)).rows[0];
    if (Object.values(check).some(value => value !== true)) throw new Error('Migration postconditions failed.');
    if (mode === 'apply') {
      await client.query('COMMIT');
      committed = true;
    }
    console.log(JSON.stringify({ projectRef, mode, versions: sources.map(({ version, sha256 }) => ({ version, sha256 })),
      retainedCounts: after, postconditions: check, committed }));
  } finally {
    if (!committed) await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}
