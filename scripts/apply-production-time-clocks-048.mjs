// Guarded production migration for independent personal and job clocks.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
const mode = process.argv[2];
if (!['dry-run', 'apply', 'verify'].includes(mode)) {
  throw new Error('Usage: node scripts/apply-production-time-clocks-048.mjs <dry-run|apply|verify>');
}
const connectionString = process.env.REDLINE_DATABASE_URL;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!connectionString || !apiUrl) throw new Error('Production connection settings are missing.');
const db = new URL(connectionString);
const api = new URL(apiUrl);
const apiRef = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const dbRef = db.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ??
  decodeURIComponent(db.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
if (apiRef !== 'vcjjkaompuriaqybjygm' || dbRef !== apiRef) {
  throw new Error('Production project guard failed.');
}
const sourceName = '048_independent_workday_and_job_clocks.sql';
const source = readFileSync(path.join(root, 'supabase/migrations', sourceName));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

let manifest;
if (mode !== 'verify') {
  const backupRoot = path.join(root, '.redline-backups');
  const directories = existsSync(backupRoot) ? readdirSync(backupRoot)
    .filter(name => /^\d{4}-\d{2}-\d{2}T/.test(name) && statSync(path.join(backupRoot, name)).isDirectory()) : [];
  const latest = directories.sort().at(-1);
  if (!latest) throw new Error('A fresh database and object snapshot is required.');
  const backupPath = path.join(backupRoot, latest);
  manifest = JSON.parse(readFileSync(path.join(backupPath, 'manifest.json'), 'utf8'));
  const age = Date.now() - new Date(manifest.capturedAt).getTime();
  if (manifest.projectRef !== apiRef || !Number.isFinite(age) || age < 0 || age > 2 * 60 * 60 * 1000 ||
      manifest.database?.sha256 !== hash(readFileSync(path.join(backupPath, 'database.dump'))) ||
      !Array.isArray(manifest.objects) ||
      manifest.objects.some(object => object.sha256 !== hash(readFileSync(path.join(backupPath, object.file))) ||
        object.bytes !== statSync(path.join(backupPath, object.file)).size) ||
      !['042', '044', '045', '046'].every(version => manifest.migrations.includes(version)) ||
      manifest.migrations.includes('048')) {
    throw new Error('Snapshot project, checksum, freshness, or migration history failed.');
  }
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
  query_timeout: 60000, statement_timeout: 60000 });
await client.connect();
try {
  await client.query(mode === 'verify' ? 'BEGIN READ ONLY' : 'BEGIN');
  let committed = false;
  try {
    if (mode !== 'verify') {
      await client.query("SET LOCAL lock_timeout = '5s'");
      const lock = await client.query("SELECT pg_try_advisory_xact_lock(hashtext('redline:production-migration')) AS held");
      if (!lock.rows[0].held) throw new Error('Another production migration is in progress.');
    }
    const versions = (await client.query(`SELECT version FROM supabase_migrations.schema_migrations
      WHERE version IN ('042','044','045','046','047','048') ORDER BY version`)).rows.map(row => row.version);
    const expected = mode === 'verify' ? ['042', '044', '045', '046', '048'] : ['042', '044', '045', '046'];
    if (expected.some(version => !versions.includes(version)) ||
        (mode === 'verify') !== versions.includes('048')) {
      throw new Error('Deployed migration history differs from the expected state.');
    }
    if (manifest && manifest.migrations.join(',') !== (await client.query(
      'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version')).rows.map(row => row.version).join(',')) {
      throw new Error('Migration history changed after the snapshot.');
    }
    const before = (await client.query(`SELECT
      (SELECT count(*)::int FROM public.time_entries) AS entries,
      (SELECT count(*)::int FROM storage.objects) AS objects,
      (SELECT count(*)::int FROM public.profiles WHERE role='owner' AND status='active') AS owners,
      (SELECT count(*)::int FROM (
        SELECT employee_id FROM public.time_entries WHERE clock_out IS NULL AND job_id IS NULL
        GROUP BY employee_id HAVING count(*) > 1) conflicts) AS personal_conflicts,
      (SELECT count(*)::int FROM (
        SELECT employee_id FROM public.time_entries WHERE clock_out IS NULL AND job_id IS NOT NULL
        GROUP BY employee_id HAVING count(*) > 1) conflicts) AS job_conflicts,
      to_regprocedure('public.can_access_legacy_job(uuid)') IS NOT NULL AS job_scope,
      EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='time_entries'
        AND policyname='Current active MFA account required') AS mfa_policy,
      EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='time_entries'
        AND policyname='Active staff can clock in personally') AS personal_policy,
      to_regclass('public.time_entries_one_open_per_employee') IS NOT NULL AS old_index`)).rows[0];
    if (before.owners !== 1 || before.personal_conflicts || before.job_conflicts ||
        !before.job_scope || !before.mfa_policy || !before.personal_policy ||
        (mode === 'verify') === before.old_index ||
        (manifest && before.objects !== manifest.objects.length)) {
      throw new Error('Time-entry schema or retained counts differ from the reviewed state.');
    }
    if (mode !== 'verify') {
      await client.query(source.toString('utf8'));
      if (mode === 'apply') {
        await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ($1,$2)',
          ['048', sourceName.slice(4, -4)]);
      }
    }
    const after = (await client.query(`SELECT
      (SELECT count(*)::int FROM public.time_entries) AS entries,
      (SELECT count(*)::int FROM storage.objects) AS objects,
      (SELECT count(*)::int FROM public.profiles WHERE role='owner' AND status='active') AS owners,
      to_regclass('public.time_entries_one_open_per_employee') IS NULL AS old_index_removed,
      to_regclass('public.time_entries_one_open_workday_per_employee') IS NOT NULL AS personal_index,
      to_regclass('public.time_entries_one_open_job_per_employee') IS NOT NULL AS job_index,
      EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='time_entries'
        AND policyname='Active assigned staff can clock in to a job' AND with_check LIKE '%aal2%'
        AND with_check LIKE '%can_access_legacy_job%') AS job_policy,
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.time_entries'::regclass
        AND tgname='time_entry_clock_identity_guard' AND NOT tgisinternal AND tgenabled='O') AS identity_guard`)).rows[0];
    if (after.entries !== before.entries || after.objects !== before.objects || after.owners !== before.owners ||
        !after.old_index_removed || !after.personal_index || !after.job_index ||
        !after.job_policy || !after.identity_guard) {
      throw new Error('Time-clock migration postconditions or retained counts failed.');
    }
    if (mode === 'apply') {
      await client.query('COMMIT');
      committed = true;
    }
    console.log(JSON.stringify({ projectRef: apiRef, mode, version: '048', sha256: hash(source),
      versions, retainedCounts: { entries: after.entries, objects: after.objects, owners: after.owners },
      postconditions: { personalIndex: after.personal_index, jobIndex: after.job_index,
        jobPolicy: after.job_policy, identityGuard: after.identity_guard }, committed }));
  } finally {
    if (!committed) await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}
