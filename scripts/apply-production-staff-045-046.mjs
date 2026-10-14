// Guarded production-only SQL rehearsal and application. Never blanket-push
// this project's migration directory: older history has known gaps.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
const mode = process.argv[2];
if (!['dry-run', 'apply', 'verify'].includes(mode)) {
  throw new Error('Usage: node scripts/apply-production-staff-045-046.mjs <dry-run|apply|verify>');
}
const connectionString = process.env.REDLINE_DATABASE_URL;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!connectionString || !apiUrl) throw new Error('Production connection settings are missing.');
const db = new URL(connectionString);
const api = new URL(apiUrl);
const projectRef = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const dbRef = db.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ??
  decodeURIComponent(db.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
if (projectRef !== 'vcjjkaompuriaqybjygm' || dbRef !== projectRef) {
  throw new Error('Production project guard failed.');
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let manifest;
if (mode !== 'verify') {
  const backupRoot = path.join(root, '.redline-backups');
  const newest = existsSync(backupRoot) ? readdirSync(backupRoot).sort().at(-1) : null;
  if (!newest) throw new Error('A fresh database and object snapshot is required.');
  const backupPath = path.join(backupRoot, newest);
  manifest = JSON.parse(readFileSync(path.join(backupPath, 'manifest.json'), 'utf8'));
  const age = Date.now() - new Date(manifest.capturedAt).getTime();
  if (manifest.projectRef !== projectRef || !Number.isFinite(age) || age < 0 || age > 2 * 60 * 60 * 1000 ||
      manifest.database?.sha256 !== hash(readFileSync(path.join(backupPath, 'database.dump'))) ||
      !Array.isArray(manifest.objects) ||
      manifest.objects.some(object => object.sha256 !== hash(readFileSync(path.join(backupPath, object.file))))) {
    throw new Error('Snapshot project, checksum, or freshness verification failed.');
  }
  if (!['041', '042', '043', '044'].every(version => manifest.migrations.includes(version)) ||
      manifest.migrations.includes('045') || manifest.migrations.includes('046')) {
    throw new Error('Snapshot migration history differs from the expected pre-045 state.');
  }
}

const sources = ['045', '046'].map(version => {
  const matches = readdirSync(path.join(root, 'supabase/migrations'))
    .filter(file => file.startsWith(`${version}_`) && file.endsWith('.sql'));
  if (matches.length !== 1) throw new Error(`Expected one SQL file for migration ${version}.`);
  const bytes = readFileSync(path.join(root, 'supabase/migrations', matches[0]));
  return { version, name: matches[0].slice(4, -4), sql: bytes.toString('utf8'), sha256: hash(bytes) };
});

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
  query_timeout: 60000, statement_timeout: 60000 });
await client.connect();
const countsSql = `SELECT
  (SELECT count(*)::int FROM auth.users) AS auth_users,
  (SELECT count(*)::int FROM public.profiles) AS profiles,
  (SELECT count(*)::int FROM public.customers) AS customers,
  (SELECT count(*)::int FROM public.work_orders) AS work_orders,
  (SELECT count(*)::int FROM public.staff_invitations) AS invitations,
  (SELECT count(*)::int FROM storage.objects) AS objects,
  (SELECT count(*)::int FROM public.profiles WHERE role='owner' AND status='active') AS owners`;
const postSql = `SELECT
  to_regclass('public.staff_account_setups') IS NOT NULL AS setup_table,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.staff_account_setups'::regclass) AS setup_rls,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_account_setups'
    AND policyname='Owner and account holder can read staff setup') AS setup_policy,
  to_regprocedure('public.register_staff_account_setup(uuid,text,text,text,app_role)') IS NOT NULL AS register_command,
  to_regprocedure('public.complete_staff_account_setup(uuid)') IS NOT NULL AS complete_command,
  has_function_privilege('authenticated',
    'public.register_staff_account_setup(uuid,text,text,text,app_role)', 'EXECUTE') AS authenticated_register,
  has_function_privilege('service_role', 'public.complete_staff_account_setup(uuid)', 'EXECUTE') AS service_complete,
  NOT has_function_privilege('authenticated', 'public.complete_staff_account_setup(uuid)', 'EXECUTE') AS no_user_complete,
  NOT has_function_privilege('authenticated',
    'public.create_staff_invitation(text,text,text,app_role)', 'EXECUTE') AS no_old_invite,
  NOT has_function_privilege('service_role', 'public.accept_staff_invitation(uuid)', 'EXECUTE') AS no_old_accept,
  to_regprocedure('public.assigned_legacy_business_name(uuid)') IS NOT NULL AS legacy_business_name,
  has_function_privilege('authenticated', 'public.assigned_legacy_business_name(uuid)', 'EXECUTE') AS staff_business_name,
  position('CASE WHEN v_role = ''owner'' THEN c.first_name END' in
    pg_get_functiondef('public.search_assigned_work_orders(text,text,text,integer,integer)'::regprocedure)) > 0
    AS search_owner_name_guard`;
try {
  await client.query(mode === 'verify' ? 'BEGIN READ ONLY' : 'BEGIN');
  let committed = false;
  try {
    if (mode !== 'verify') {
      await client.query("SET LOCAL lock_timeout = '5s'");
      const lock = await client.query("SELECT pg_try_advisory_xact_lock(hashtext('redline:production-migration')) AS held");
      if (!lock.rows[0].held) throw new Error('Another production migration is in progress.');
    }
    const history = (await client.query(`SELECT version FROM supabase_migrations.schema_migrations
      WHERE version IN ('041','042','043','044','045','046') ORDER BY version`)).rows.map(row => row.version);
    const expected = mode === 'verify' ? '041,042,043,044,045,046' : '041,042,043,044';
    if (history.join(',') !== expected) throw new Error('Deployed migration history differs from the expected state.');
    const newer = (await client.query(`SELECT count(*)::int AS n FROM supabase_migrations.schema_migrations
      WHERE version ~ '^[0-9]+$' AND version::int > 46`)).rows[0].n;
    if (newer !== 0) throw new Error('Unexpected newer migrations are deployed.');
    const before = (await client.query(countsSql)).rows[0];
    if (before.owners !== 1 || (manifest && before.objects !== manifest.objects.length)) {
      throw new Error('Owner or Storage object count differs from the verified snapshot.');
    }
    if (mode !== 'verify') {
      for (const source of sources) {
        await client.query(source.sql);
        if (mode === 'apply') {
          await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ($1,$2)',
            [source.version, source.name]);
        }
      }
    }
    const after = (await client.query(countsSql)).rows[0];
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Retained row counts changed during migration.');
    const postconditions = (await client.query(postSql)).rows[0];
    if (Object.values(postconditions).some(value => value !== true)) {
      throw new Error(`Migration postconditions failed: ${Object.entries(postconditions)
        .filter(([, value]) => value !== true).map(([key]) => key).join(', ')}`);
    }
    if (mode === 'apply') {
      await client.query('COMMIT');
      committed = true;
    }
    console.log(JSON.stringify({ projectRef, mode, versions: sources.map(({ version, sha256 }) => ({ version, sha256 })),
      retainedCounts: after, postconditions, committed }));
  } finally {
    if (!committed) await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}
