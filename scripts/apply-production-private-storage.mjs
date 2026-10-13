// Apply the final private-storage policy only to the reviewed production project.
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
const latest = existsSync(backupRoot) ? readdirSync(backupRoot).sort().at(-1) : null;
if (!latest) throw new Error('A pre-change snapshot is required.');
const backupPath = path.join(backupRoot, latest);
const manifest = JSON.parse(readFileSync(path.join(backupPath, 'manifest.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (manifest.projectRef !== projectRef || manifest.objects?.length !== 7 ||
    manifest.database?.sha256 !== hash(readFileSync(path.join(backupPath, 'database.dump'))) ||
    Date.now() - new Date(manifest.capturedAt).getTime() > 3 * 60 * 60 * 1000 ||
    manifest.objects.some(object => object.sha256 !== hash(readFileSync(path.join(backupPath, object.file))))) {
  throw new Error('Snapshot verification failed.');
}

const source = readFileSync(path.join(root, 'supabase/migrations/042_private_field_storage.sql'), 'utf8');
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
    const history = await client.query(`SELECT version FROM supabase_migrations.schema_migrations
      WHERE version IN ('021','022','023','024','025','026','027','028','029','030','031','032','033','034','035','036','037','039','040','041','042')
      ORDER BY version`);
    const expected = ['021','022','023','024','025','026','027','028','029','030','031','032','033','034','035','036','037','039','040','041'];
    if (history.rows.map(row => row.version).join(',') !== expected.join(',')) {
      throw new Error('Production migration history changed.');
    }
    const before = await client.query(`SELECT b.public,
      (SELECT count(*)::int FROM storage.objects) AS object_count,
      (SELECT count(*)::int FROM public.job_photos) AS photo_count
      FROM storage.buckets b WHERE b.id='job-photos'`);
    if (before.rowCount !== 1 || before.rows[0].public !== true || before.rows[0].object_count !== 7 || before.rows[0].photo_count !== 0) {
      throw new Error('Storage preconditions changed.');
    }
    await client.query(source);
    await client.query(`INSERT INTO supabase_migrations.schema_migrations(version,name)
      VALUES ('042','private_field_storage')`);
    const after = await client.query(`SELECT b.public,
      (SELECT count(*)::int FROM storage.objects) AS object_count,
      (SELECT count(*)::int FROM public.job_photos) AS photo_count
      FROM storage.buckets b WHERE b.id='job-photos'`);
    const broad = await client.query(`SELECT policyname FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects' AND policyname IN
      ('Authenticated users can read service evidence','Authenticated users can upload service evidence',
       'Public can view job photos','Public can view job photos storage',
       'Staff can upload gallery images','Staff can update gallery images','Staff can delete gallery images')`);
    if (after.rowCount !== 1 || after.rows[0].public !== false ||
        after.rows[0].object_count !== before.rows[0].object_count ||
        after.rows[0].photo_count !== before.rows[0].photo_count || broad.rowCount !== 0) {
      throw new Error('Storage postconditions failed.');
    }
    await client.query('COMMIT');
    committed = true;
    console.log(JSON.stringify({ projectRef, applied: '042', privateJobPhotos: true,
      objectCount: after.rows[0].object_count, linkedPhotoCount: after.rows[0].photo_count }));
  } finally {
    if (!committed) await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}
