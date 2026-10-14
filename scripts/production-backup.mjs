// Read-only production database/object snapshot. Never add its output to Git.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
const connectionString = process.env.REDLINE_DATABASE_URL;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!connectionString || !apiUrl || !serviceKey) throw new Error('Production backup settings are missing.');
const db = new URL(connectionString);
const api = new URL(apiUrl);
const apiRef = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const dbRef = db.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ??
  decodeURIComponent(db.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
if (!apiRef || apiRef !== dbRef) throw new Error('Database URL and Storage project differ.');
const dumpTool = process.env.REDLINE_PG_DUMP_PATH ??
  path.join(root, '.tools', 'pgsql', 'bin', 'pg_dump.exe');
const restoreTool = path.join(path.dirname(dumpTool), 'pg_restore.exe');
if (!existsSync(dumpTool) || !existsSync(restoreTool)) {
  throw new Error('PostgreSQL 17 pg_dump and pg_restore are required.');
}

const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const backupDir = path.join(root, '.redline-backups', stamp);
mkdirSync(backupDir, { recursive: true });
const archive = path.join(backupDir, 'database.dump');
const environment = { ...process.env, PGPASSWORD: decodeURIComponent(db.password), PGSSLMODE: 'require' };
const args = [
  '--format=custom', '--no-owner', '--no-acl', '--no-password',
  '--host', db.hostname, '--port', db.port || '5432',
  '--username', decodeURIComponent(db.username), '--dbname', db.pathname.slice(1),
  '--file', archive,
];
const dumped = spawnSync(dumpTool, args, { env: environment, encoding: 'utf8', timeout: 180000 });
if (dumped.error || dumped.status !== 0) {
  throw new Error(`pg_dump failed: ${(dumped.stderr || dumped.error?.message || '').trim()}`);
}
const listed = spawnSync(restoreTool, ['--list', archive], { encoding: 'utf8', timeout: 30000 });
if (listed.error || listed.status !== 0 || !listed.stdout.includes('TABLE DATA')) {
  throw new Error('The database archive failed pg_restore listing verification.');
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
  query_timeout: 30000, statement_timeout: 30000 });
await client.connect();
let objectRows;
let migrations;
try {
  await client.query('BEGIN READ ONLY');
  try {
    objectRows = (await client.query(`SELECT bucket_id, name, metadata
      FROM storage.objects ORDER BY bucket_id, name`)).rows;
    migrations = (await client.query(`SELECT version FROM supabase_migrations.schema_migrations
      ORDER BY version`)).rows.map(row => row.version);
  } finally {
    await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}

const storage = createClient(apiUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const objectManifest = [];
for (let index = 0; index < objectRows.length; index += 1) {
  const row = objectRows[index];
  const { data, error } = await storage.storage.from(row.bucket_id).download(row.name);
  if (error || !data) throw new Error(`Storage object ${index + 1} of ${objectRows.length} could not be downloaded.`);
  const bytes = Buffer.from(await data.arrayBuffer());
  const file = `object-${String(index + 1).padStart(6, '0')}.bin`;
  writeFileSync(path.join(backupDir, file), bytes, { flag: 'wx' });
  objectManifest.push({ bucket: row.bucket_id, objectKey: row.name, file,
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    metadata: row.metadata });
}

const archiveBytes = readFileSync(archive);
const manifest = {
  projectRef: apiRef,
  capturedAt: new Date().toISOString(),
  database: { file: 'database.dump', bytes: archiveBytes.length,
    sha256: createHash('sha256').update(archiveBytes).digest('hex') },
  migrations,
  objects: objectManifest,
  warning: 'Local snapshot only. Restore has not been rehearsed; copy to an independently controlled encrypted backup location.',
};
writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ backupDirectory: backupDir, databaseBytes: archiveBytes.length,
  objectCount: objectManifest.length, migrationCount: migrations.length,
  restoreVerified: false, independentCopyVerified: false }, null, 2));
