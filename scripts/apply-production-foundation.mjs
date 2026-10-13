// Apply only the independent, backwards-compatible 021-023 foundation changes.
// Run 024+ with the coordinated application/Auth cutover, not from this script.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
const mode = process.argv[2];
if (!['dry-run', 'apply'].includes(mode)) throw new Error('Usage: node scripts/apply-production-foundation.mjs <dry-run|apply>');
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
if (!recent) throw new Error('A pre-change database and object snapshot is required.');
const backupPath = path.join(backupRoot, recent);
const manifest = JSON.parse(readFileSync(path.join(backupPath, 'manifest.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (manifest.projectRef !== projectRef || manifest.objects?.length !== 7 ||
    manifest.database?.sha256 !== hash(readFileSync(path.join(backupPath, 'database.dump'))) ||
    Date.now() - new Date(manifest.capturedAt).getTime() > 3 * 60 * 60 * 1000 ||
    manifest.objects.some(object => object.sha256 !== hash(readFileSync(path.join(backupPath, object.file))))) {
  throw new Error('Snapshot checksum, project, or freshness check failed.');
}

const migrations = [
  ['021', 'signup_least_privilege', '03902aba9525c2f3eeb8855ce81bec62f246471f5f9ff88941bf4d0b9005ccc0'],
  ['022', 'single_open_visit', '44b6f4141b94f530e7f78d30daed4facc975383f1d9c16fbc3d1d05dc143f8b9'],
  ['023', 'staff_role_values', '67b0ade4818e2b110f8fcaa2f44ef9a17747f7504698b93aeff53d7c6acc7c8e'],
];
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
  query_timeout: 30000, statement_timeout: 30000 });
await client.connect();
try {
  const roles = await client.query(`SELECT
    count(*) FILTER (WHERE status='active' AND role='owner')::int AS owners,
    count(*) FILTER (WHERE status='active' AND role='crew_member')::int AS legacy_members
    FROM public.profiles`);
  if (roles.rows[0].owners !== 1 || roles.rows[0].legacy_members !== 1) {
    throw new Error('Active owner or legacy laborer count changed.');
  }
  for (const [version, name, expectedHash] of migrations) {
    const source = readFileSync(path.join(root, 'supabase/migrations', `${version}_${name}.sql`), 'utf8');
    if (hash(source) !== expectedHash) throw new Error(`Migration ${version} differs from the reviewed file.`);
    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      const lock = await client.query("SELECT pg_try_advisory_xact_lock(hashtext('redline:production-migration')) AS held");
      if (!lock.rows[0].held) throw new Error('Another production migration is in progress.');
      const existing = await client.query('SELECT version FROM supabase_migrations.schema_migrations WHERE version=$1', [version]);
      if (existing.rowCount) {
        await client.query('ROLLBACK');
        console.log(JSON.stringify({ version, status: 'already_applied' }));
        continue;
      }
      if (version === '021') {
        const current = await client.query("SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) AS definition");
        if (!current.rows[0].definition.includes('raw_user_meta_data')) {
          throw new Error('Signup trigger differs from the reviewed precondition.');
        }
      }
      await client.query(source);
      await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ($1,$2)', [version, name]);
      if (mode === 'apply') await client.query('COMMIT');
      else await client.query('ROLLBACK');
      console.log(JSON.stringify({ version, status: mode === 'apply' ? 'applied' : 'dry_run_passed' }));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.end();
}
