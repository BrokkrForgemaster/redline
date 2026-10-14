// Guarded production migration: legacy job progress and scoped visual alerts.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
const mode = process.argv[2];
if (!['dry-run', 'apply', 'verify'].includes(mode)) {
  throw new Error('Usage: node scripts/apply-production-legacy-progress-049.mjs <dry-run|apply|verify>');
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
const sourceName = '049_legacy_job_visible_progress.sql';
const source = readFileSync(path.join(root, 'supabase/migrations', sourceName));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let manifest;
if (mode !== 'verify') {
  const backupRoot = path.join(root, '.redline-backups');
  const dirs = existsSync(backupRoot) ? readdirSync(backupRoot)
    .filter(name => /^\d{4}-\d{2}-\d{2}T/.test(name) && statSync(path.join(backupRoot, name)).isDirectory()) : [];
  const latest = dirs.sort().at(-1);
  if (!latest) throw new Error('A fresh database and object snapshot is required.');
  const backupPath = path.join(backupRoot, latest);
  manifest = JSON.parse(readFileSync(path.join(backupPath, 'manifest.json'), 'utf8'));
  const age = Date.now() - new Date(manifest.capturedAt).getTime();
  if (manifest.projectRef !== apiRef || !Number.isFinite(age) || age < 0 || age > 2 * 60 * 60 * 1000 ||
      manifest.database?.sha256 !== hash(readFileSync(path.join(backupPath, 'database.dump'))) ||
      !Array.isArray(manifest.objects) ||
      manifest.objects.some(object => object.sha256 !== hash(readFileSync(path.join(backupPath, object.file))) ||
        object.bytes !== statSync(path.join(backupPath, object.file)).size) ||
      !['042', '043', '044', '045', '046', '048'].every(version => manifest.migrations.includes(version)) ||
      manifest.migrations.includes('049')) {
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
    const versions = (await client.query(
      'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version'))
      .rows.map(row => row.version);
    if (manifest && manifest.migrations.join(',') !== versions.join(',')) {
      throw new Error('Migration history changed after the snapshot.');
    }
    if ((mode === 'verify') !== versions.includes('049') ||
        !['042', '043', '044', '045', '046', '048'].every(version => versions.includes(version))) {
      throw new Error('Deployed migration history differs from expected state.');
    }
    const countsSql = `SELECT
      (SELECT count(*)::int FROM public.jobs) AS jobs,
      (SELECT count(*)::int FROM public.time_entries) AS entries,
      (SELECT count(*)::int FROM public.job_photos) AS photos,
      (SELECT count(*)::int FROM storage.objects) AS objects,
      (SELECT count(*)::int FROM public.profiles WHERE role='owner' AND status='active') AS owners,
      (SELECT count(*)::int FROM public.notifications) AS alerts,
      (SELECT count(*)::int FROM public.job_status_history) AS history,
      (SELECT count(*)::int FROM public.jobs job WHERE job.status IN
        ('approved','ready_to_schedule','scheduled','en_route','arrived')
        AND EXISTS (SELECT 1 FROM public.time_entries entry
          WHERE entry.job_id=job.id AND entry.clock_out IS NULL AND NOT entry.is_manual
          AND EXISTS (SELECT 1 FROM public.job_location_tags tag
            WHERE tag.job_id=job.id AND tag.employee_id=entry.employee_id AND tag.tag_type='manual')
          AND (SELECT count(*) FROM public.job_photos photo
            JOIN storage.objects object ON object.bucket_id='job-photos'
              AND object.name=photo.storage_path
            WHERE photo.job_id=job.id AND photo.employee_id=entry.employee_id
              AND photo.photo_type='before') >= 3)) AS eligible`;
    const before = (await client.query(countsSql)).rows[0];
    if (before.owners !== 1 || (manifest && before.objects !== manifest.objects.length)) {
      throw new Error('Owner or Storage counts differ from the reviewed snapshot.');
    }
    if (mode !== 'verify') {
      await client.query(source.toString('utf8'));
      if (mode === 'apply') {
        await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ($1,$2)',
          ['049', sourceName.slice(4, -4)]);
      }
    }
    const after = (await client.query(countsSql)).rows[0];
    const guards = (await client.query(`SELECT
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.time_entries'::regclass
        AND tgname='legacy_job_clock_start_progress' AND NOT tgisinternal AND tgenabled='O') AS start_trigger,
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.job_photos'::regclass
        AND tgname='legacy_job_photo_saved_progress' AND NOT tgisinternal AND tgenabled='O') AS photo_trigger,
      to_regclass('public.notifications_legacy_event_recipient_unique') IS NOT NULL AS alert_index`)).rows[0];
    if ([after.jobs, after.entries, after.photos, after.objects, after.owners]
      .some((value, index) => value !== [before.jobs, before.entries, before.photos, before.objects, before.owners][index]) ||
      after.eligible !== 0 || !guards.start_trigger || !guards.photo_trigger || !guards.alert_index ||
      (mode !== 'verify' && (after.history !== before.history + before.eligible ||
        after.alerts < before.alerts))) {
      throw new Error('Migration postconditions or retained counts failed.');
    }
    if (mode === 'apply') {
      await client.query('COMMIT');
      committed = true;
    }
    console.log(JSON.stringify({ projectRef: apiRef, mode, version: '049', sha256: hash(source),
      eligibleBefore: before.eligible, eligibleAfter: after.eligible,
      retainedCounts: { jobs: after.jobs, entries: after.entries, photos: after.photos,
        objects: after.objects, owners: after.owners },
      addedHistory: after.history - before.history, addedInboxAlerts: after.alerts - before.alerts,
      guards, committed }));
  } finally {
    if (!committed) await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}
