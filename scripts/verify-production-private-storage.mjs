// Read-only check of deployed private field storage and retained public gallery.
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
if (projectRef !== 'vcjjkaompuriaqybjygm' || dbRef !== projectRef) throw new Error('Production project guard failed.');

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000, query_timeout: 10000 });
await client.connect();
let record;
try {
  const result = await client.query(`SELECT
    (SELECT count(*)::int FROM supabase_migrations.schema_migrations WHERE version='042') AS migration_count,
    (SELECT public FROM storage.buckets WHERE id='job-photos') AS job_photos_public,
    (SELECT public FROM storage.buckets WHERE id='gallery') AS gallery_public,
    (SELECT count(*)::int FROM storage.objects) AS object_count,
    (SELECT count(*)::int FROM public.job_photos) AS linked_photo_count,
    (SELECT name FROM storage.objects WHERE bucket_id='job-photos' ORDER BY name LIMIT 1) AS probe_object`);
  record = result.rows[0];
} finally {
  await client.end();
}
if (record.migration_count !== 1 || record.job_photos_public !== false ||
    record.gallery_public !== true || record.object_count !== 7 ||
    record.linked_photo_count !== 0 || !record.probe_object) {
  throw new Error('Deployed storage state differs from reviewed postconditions.');
}
const objectPath = record.probe_object.split('/').map(encodeURIComponent).join('/');
const probe = new URL(`${api.origin}/storage/v1/object/public/job-photos/${objectPath}`);
probe.searchParams.set('redline_policy_probe', Date.now().toString());
const response = await fetch(probe, {
  headers: { 'Cache-Control': 'no-cache' }, cache: 'no-store', redirect: 'manual',
});
if (response.ok) throw new Error(`An unauthenticated public job-photo URL is still readable (status ${response.status}, cache ${response.headers.get('x-vercel-cache') ?? response.headers.get('cf-cache-status') ?? 'unknown'}).`);
console.log(JSON.stringify({ projectRef, migrationRecorded: true, privateJobPhotos: true,
  publicGalleryPreserved: true, objectCount: record.object_count,
  linkedPhotoCount: record.linked_photo_count, unauthenticatedPhotoStatus: response.status }));
