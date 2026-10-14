// Read-only evidence for missing production migration-history entries.
// Object presence is not proof that every historical SQL statement ran.
import { readFileSync } from 'node:fs';
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
const apiRef = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const dbRef = db.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ??
  decodeURIComponent(db.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
if (!apiRef || dbRef !== apiRef) throw new Error('Database URL does not match the configured application project.');

const initial = readFileSync(path.join(root, 'supabase/migrations/001_initial_schema.sql'), 'utf8');
const rls = readFileSync(path.join(root, 'supabase/migrations/002_rls_policies.sql'), 'utf8');
const names = (source, expression) => [...source.matchAll(expression)].map(match => match[1]);
const expectedTables = names(initial, /^CREATE TABLE\s+(\w+)/gm);
const expectedTypes = names(initial, /^CREATE TYPE\s+(\w+)/gm);
const expectedIndexes = names(initial, /^CREATE (?:UNIQUE )?INDEX\s+(\w+)/gm);
const rlsTables = names(rls, /^ALTER TABLE\s+(\w+)\s+ENABLE ROW LEVEL SECURITY/gm);

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
  query_timeout: 20000, statement_timeout: 20000 });
await client.connect();
try {
  await client.query('BEGIN READ ONLY');
  try {
    const relations = await client.query(`SELECT c.relname, c.relrowsecurity FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname = ANY($1)`, [expectedTables]);
    const types = await client.query(`SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname='public' AND t.typname = ANY($1)`, [expectedTypes]);
    const indexes = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='i' AND c.relname = ANY($1)`, [expectedIndexes]);
    const buckets = await client.query(`SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets
        WHERE id IN ('gallery','avatars','job-photos') ORDER BY id`);
    const policies = await client.query(`SELECT policyname, cmd, qual, with_check FROM pg_policies
        WHERE schemaname='public' AND tablename='time_entries'
          AND policyname='Employees can update their own open entries'`);
    const publication = await client.query(`SELECT tablename FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public'
          AND tablename IN ('jobs','notifications','time_entries')`);
    const seeds = await client.query(`SELECT (SELECT count(*)::int FROM public.permissions) AS permissions,
        (SELECT count(*)::int FROM public.role_permissions) AS role_permissions`);
    const migrationHistory = await client.query(`SELECT version FROM supabase_migrations.schema_migrations
        WHERE version IN ('001','002','003','004','005','013','018','019','020') ORDER BY version`);
    const migrationHistoryColumns = await client.query(`SELECT column_name, data_type, is_nullable
      FROM information_schema.columns WHERE table_schema = 'supabase_migrations'
        AND table_name = 'schema_migrations' ORDER BY ordinal_position`);
    const tableMap = new Map(relations.rows.map(row => [row.relname, row]));
    const typeSet = new Set(types.rows.map(row => row.typname));
    const indexSet = new Set(indexes.rows.map(row => row.relname));
    const published = new Set(publication.rows.map(row => row.tablename));
    const bucketMap = new Map(buckets.rows.map(row => [row.id, row]));
    const timePolicy = policies.rows[0];
    console.log(JSON.stringify({
      projectRef: apiRef,
      recordedHistoricalVersions: migrationHistory.rows.map(row => row.version),
      migrationHistoryColumns: migrationHistoryColumns.rows,
      initialSchema: {
        expectedTables: expectedTables.length,
        missingTables: expectedTables.filter(name => !tableMap.has(name)),
        expectedTypes: expectedTypes.length,
        missingTypes: expectedTypes.filter(name => !typeSet.has(name)),
        expectedIndexes: expectedIndexes.length,
        missingIndexes: expectedIndexes.filter(name => !indexSet.has(name)),
      },
      rls: { expectedTables: rlsTables.length,
        disabledTables: rlsTables.filter(name => !tableMap.get(name)?.relrowsecurity) },
      permissionsSeed: seeds.rows[0],
      storage: {
        galleryBucketPresent: bucketMap.has('gallery'),
        avatarBucketPresent: bucketMap.has('avatars'),
        jobPhotosBucket: bucketMap.get('job-photos') ?? null,
      },
      timeEntryCorrection: {
        policyPresent: Boolean(timePolicy),
        explicitWithCheck: Boolean(timePolicy?.with_check),
        existingUsing: timePolicy?.qual ?? null,
        existingWithCheck: timePolicy?.with_check ?? null,
      },
      realtime: {
        notifications: published.has('notifications'),
        jobs: published.has('jobs'),
        timeEntries: published.has('time_entries'),
      },
      warning: 'Object checks are necessary but insufficient for marking omitted migrations applied.',
    }, null, 2));
  } finally {
    await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}
