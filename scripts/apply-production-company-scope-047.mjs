// Guarded rollout for the previously pending company supervisor scope update.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
const mode = process.argv[2];
if (!['dry-run', 'apply', 'verify'].includes(mode)) {
  throw new Error('Usage: node scripts/apply-production-company-scope-047.mjs <dry-run|apply|verify>');
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
const sourceName = '047_company_supervisor_job_scope.sql';
const source = readFileSync(path.join(root, 'supabase/migrations', sourceName));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let manifest;
if (mode !== 'verify') {
  const backupRoot = path.join(root, '.redline-backups');
  const latest = existsSync(backupRoot) ? readdirSync(backupRoot)
    .filter(name => /^\d{4}-\d{2}-\d{2}T/.test(name) && statSync(path.join(backupRoot, name)).isDirectory())
    .sort().at(-1) : null;
  if (!latest) throw new Error('A fresh database and object snapshot is required.');
  const backupPath = path.join(backupRoot, latest);
  manifest = JSON.parse(readFileSync(path.join(backupPath, 'manifest.json'), 'utf8'));
  const age = Date.now() - new Date(manifest.capturedAt).getTime();
  if (manifest.projectRef !== apiRef || !Number.isFinite(age) || age < 0 || age > 2 * 60 * 60 * 1000 ||
      manifest.database?.sha256 !== hash(readFileSync(path.join(backupPath, 'database.dump'))) ||
      !Array.isArray(manifest.objects) ||
      manifest.objects.some(object => object.sha256 !== hash(readFileSync(path.join(backupPath, object.file))) ||
        object.bytes !== statSync(path.join(backupPath, object.file)).size) ||
      !['046', '048', '049', '050'].every(version => manifest.migrations.includes(version)) ||
      manifest.migrations.includes('047')) {
    throw new Error('Snapshot project, checksum, freshness, or migration history failed.');
  }
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
  query_timeout: 90000, statement_timeout: 90000 });
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
    const versions = (await client.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version'))
      .rows.map(row => row.version);
    if (manifest && manifest.migrations.join(',') !== versions.join(',')) {
      throw new Error('Migration history changed after the snapshot.');
    }
    if ((mode === 'verify') !== versions.includes('047') ||
        !['046', '048', '049', '050'].every(version => versions.includes(version))) {
      throw new Error('Deployed migration history differs from expected state.');
    }
    const countsSql = `SELECT
      (SELECT count(*)::int FROM public.profiles) AS profiles,
      (SELECT count(*)::int FROM public.jobs) AS jobs,
      (SELECT count(*)::int FROM public.work_orders) AS work_orders,
      (SELECT count(*)::int FROM public.crews) AS crews,
      (SELECT count(*)::int FROM storage.objects) AS objects,
      (SELECT count(*)::int FROM public.profiles WHERE role='owner' AND status='active') AS owners`;
    const before = (await client.query(countsSql)).rows[0];
    if (before.owners !== 1 || (manifest && before.objects !== manifest.objects.length)) {
      throw new Error('Owner or Storage counts differ from the reviewed snapshot.');
    }
    if (mode !== 'verify') {
      await client.query(source.toString('utf8'));
      if (mode === 'apply') {
        await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ($1,$2)',
          ['047', sourceName.slice(4, -4)]);
      }
    }
    const after = (await client.query(countsSql)).rows[0];
    const guards = (await client.query(`SELECT
      to_regprocedure('public.is_current_company_supervisor_for_crew(uuid)') IS NOT NULL AS supervisor_helper,
      has_function_privilege('authenticated',
        'public.is_current_company_supervisor_for_crew(uuid)', 'EXECUTE') AS supervisor_grant,
      NOT has_function_privilege('anon',
        'public.is_current_company_supervisor_for_crew(uuid)', 'EXECUTE') AS anon_denied,
      pg_get_functiondef('public.can_access_legacy_job(uuid)'::regprocedure)
        LIKE '%is_current_company_supervisor_for_crew%' AS legacy_scope,
      pg_get_functiondef('public.search_assigned_work_orders(text,text,text,integer,integer)'::regprocedure)
        LIKE '%is_current_company_supervisor_for_crew%' AS search_scope`)).rows[0];
    if (Object.keys(before).some(key => before[key] !== after[key]) ||
        Object.values(guards).some(value => value !== true)) {
      throw new Error(`Scope migration postconditions or retained counts failed: ${JSON.stringify({ before, after, guards })}`);
    }
    if (mode === 'apply') {
      await client.query('COMMIT');
      committed = true;
    }
    console.log(JSON.stringify({ projectRef: apiRef, mode, version: '047', sha256: hash(source),
      retainedCounts: after, guards, committed }));
  } finally {
    if (!committed) await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}
