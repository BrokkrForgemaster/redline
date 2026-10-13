// Dry-run 024-042; apply 024-041 together after the compatible app is built.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
const mode = process.argv[2] ?? 'dry-run';
if (!['dry-run', 'apply'].includes(mode)) {
  throw new Error('Usage: node scripts/rehearse-production-migrations.mjs <dry-run|apply>');
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
const backupRoot = path.join(root, '.redline-backups');
const recent = existsSync(backupRoot) ? readdirSync(backupRoot).sort().at(-1) : null;
if (!recent) throw new Error('A pre-change snapshot is required.');
const backupPath = path.join(backupRoot, recent);
const manifest = JSON.parse(readFileSync(path.join(backupPath, 'manifest.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (manifest.projectRef !== projectRef || manifest.objects?.length !== 7 ||
    manifest.database?.sha256 !== hash(readFileSync(path.join(backupPath, 'database.dump'))) ||
    Date.now() - new Date(manifest.capturedAt).getTime() > 3 * 60 * 60 * 1000 ||
    manifest.objects.some(object => object.sha256 !== hash(readFileSync(path.join(backupPath, object.file))))) {
  throw new Error('Snapshot verification failed.');
}

const versions = [
  '024','025','026','027','028','029','030','031','032','033',
  '034','035','036','037','039','040','041','042',
];
const selectedVersions = mode === 'apply' ? versions.filter(version => version !== '042') : versions;
const files = readdirSync(path.join(root, 'supabase/migrations'));
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
    const applied = await client.query(`SELECT version FROM supabase_migrations.schema_migrations
      WHERE version IN ('021','022','023') ORDER BY version`);
    if (applied.rows.map(row => row.version).join(',') !== '021,022,023') {
      throw new Error('Foundation migration history differs from the reviewed state.');
    }
    const profiles = await client.query(`SELECT
      count(*) FILTER (WHERE status='active' AND role='owner')::int AS owners,
      count(*) FILTER (WHERE status='active' AND role='crew_member')::int AS legacy_members
      FROM public.profiles`);
    if (profiles.rows[0].owners !== 1 || profiles.rows[0].legacy_members !== 1) {
      throw new Error('Owner or approved laborer count changed.');
    }
    for (const version of selectedVersions) {
      const matching = files.filter(file => file.startsWith(`${version}_`) && file.endsWith('.sql'));
      if (matching.length !== 1) throw new Error(`Expected one migration file for ${version}.`);
      const recorded = await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1', [version]);
      if (recorded.rowCount) throw new Error(`Migration ${version} is already recorded.`);
      const source = readFileSync(path.join(root, 'supabase/migrations', matching[0]), 'utf8');
      await client.query(source);
      if (mode === 'apply') {
        await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ($1,$2)',
          [version, matching[0].slice(4, -4)]);
      } else {
        console.log(JSON.stringify({ version, sqlExecuted: true, persisted: false }));
      }
    }
    if (mode === 'apply') {
      const roles = await client.query(`SELECT
        count(*) FILTER (WHERE status='active' AND role='owner')::int AS owners,
        count(*) FILTER (WHERE status='active' AND role='crew_member')::int AS old_members,
        count(*) FILTER (WHERE status='active' AND role='mowing_crew_laborer')::int AS laborers
        FROM public.profiles`);
      const policy = await client.query(`SELECT qual, with_check FROM pg_policies
        WHERE schemaname='public' AND tablename='time_entries'
          AND policyname='Current active MFA account required'`);
      const objects = await client.query(`SELECT
        to_regclass('public.staff_invitations') IS NOT NULL AS invitations,
        to_regclass('public.mfa_recovery_requests') IS NOT NULL AS recovery,
        to_regclass('public.workflow_delivery_outbox') IS NOT NULL AS delivery`);
      const bucket = await client.query("SELECT public FROM storage.buckets WHERE id='job-photos'");
      if (roles.rows[0].owners !== 1 || roles.rows[0].old_members !== 0 || roles.rows[0].laborers !== 1 ||
          policy.rowCount !== 1 || !policy.rows[0].qual.includes("'aal2'") ||
          !objects.rows[0].invitations || !objects.rows[0].recovery || !objects.rows[0].delivery ||
          bucket.rowCount !== 1 || bucket.rows[0].public !== true) {
        throw new Error('Coordinated migration postconditions failed.');
      }
      await client.query('COMMIT');
      committed = true;
      console.log(JSON.stringify({ projectRef, applied: selectedVersions, storageVisibilityUnchanged: true }));
    }
  } finally {
    if (!committed) await client.query('ROLLBACK');
  }
  if (mode === 'dry-run') console.log(JSON.stringify({ projectRef, rehearsed: versions.length, rolledBack: true }));
} finally {
  await client.end();
}
