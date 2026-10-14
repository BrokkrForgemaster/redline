// Targeted production correction explicitly requested by the owner.
// Applies only the existing 013 migration after checking a fresh local backup.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
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
if (!recent) throw new Error('A local pre-change backup is required.');
const backupPath = path.join(backupRoot, recent);
const manifest = JSON.parse(readFileSync(path.join(backupPath, 'manifest.json'), 'utf8'));
const dump = readFileSync(path.join(backupPath, 'database.dump'));
if (manifest.projectRef !== projectRef || manifest.objects?.length !== 7 ||
    manifest.database?.sha256 !== createHash('sha256').update(dump).digest('hex') ||
    Date.now() - new Date(manifest.capturedAt).getTime() > 3 * 60 * 60 * 1000) {
  throw new Error('Backup manifest or freshness check failed.');
}
const migration = readFileSync(path.join(root,
  'supabase/migrations/013_fix_time_entries_update_policy.sql'), 'utf8');

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
  query_timeout: 30000, statement_timeout: 30000 });
await client.connect();
try {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('redline:time-entry-013'))");
    const history = await client.query(`SELECT version FROM supabase_migrations.schema_migrations
      WHERE version = '013'`);
    if (history.rowCount) throw new Error('Migration 013 is already recorded.');
    const before = await client.query(`SELECT qual, with_check FROM pg_policies
      WHERE schemaname='public' AND tablename='time_entries'
        AND policyname='Employees can update their own open entries'`);
    if (before.rowCount !== 1 || before.rows[0].with_check !== null ||
        before.rows[0].qual !== '((employee_id = auth.uid()) AND (clock_out IS NULL))') {
      throw new Error('Live policy differs from the reviewed precondition.');
    }
    await client.query(migration);
    const after = await client.query(`SELECT qual, with_check FROM pg_policies
      WHERE schemaname='public' AND tablename='time_entries'
        AND policyname='Employees can update their own open entries'`);
    if (after.rowCount !== 1 ||
        after.rows[0].with_check !== '(employee_id = auth.uid())' ||
        after.rows[0].qual !== before.rows[0].qual) {
      throw new Error('Post-migration policy verification failed.');
    }
    await client.query(`INSERT INTO supabase_migrations.schema_migrations(version, name)
      VALUES ('013', 'fix_time_entries_update_policy')`);
    await client.query('COMMIT');
    console.log(JSON.stringify({ projectRef, appliedVersion: '013',
      explicitWithCheck: true, databaseAndObjectBackup: recent }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
} finally {
  await client.end();
}
