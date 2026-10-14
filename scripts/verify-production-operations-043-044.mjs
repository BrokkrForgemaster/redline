// Read-only post-deployment check; prints counts and policy presence, no user data.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
const dbUrl = new URL(process.env.REDLINE_DATABASE_URL ?? '');
const apiUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
const projectRef = apiUrl.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const dbRef = dbUrl.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ??
  decodeURIComponent(dbUrl.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
if (projectRef !== 'vcjjkaompuriaqybjygm' || dbRef !== projectRef) {
  throw new Error('Production project guard failed.');
}
const client = new pg.Client({ connectionString: dbUrl.toString(), connectionTimeoutMillis: 10000,
  query_timeout: 20000, statement_timeout: 20000 });
await client.connect();
try {
  await client.query('BEGIN READ ONLY');
  try {
    const versions = (await client.query(`SELECT version FROM supabase_migrations.schema_migrations
      WHERE version IN ('042','043','044') ORDER BY version`)).rows.map(row => row.version);
    const state = (await client.query(`SELECT
      (SELECT count(*)::int FROM public.crews) AS crews,
      (SELECT count(*)::int FROM public.crew_members) AS crew_members,
      (SELECT count(*)::int FROM public.time_entries) AS time_entries,
      (SELECT count(*)::int FROM storage.objects) AS objects,
      (SELECT count(*)::int FROM public.profiles WHERE status='active' AND role='owner') AS owners,
      (SELECT count(*)::int FROM (
        SELECT employee_id FROM public.time_entries WHERE clock_out IS NULL
        GROUP BY employee_id HAVING count(*) > 1) conflicts) AS duplicate_open_entries,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
        AND table_name='crews' AND column_name='subcontractor_company_id') AS company_crews,
      to_regprocedure('public.manage_subcontractor_company(text,uuid,jsonb)') IS NOT NULL AS company_command,
      to_regclass('public.time_entries_one_open_per_employee') IS NOT NULL AS unique_open_entry,
      EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='time_entries'
        AND policyname='Active staff can clock in personally') AS staff_clock_policy`)).rows[0];
    if (versions.join(',') !== '042,043,044' || state.owners !== 1 ||
        state.duplicate_open_entries !== 0 || !state.company_crews || !state.company_command ||
        !state.unique_open_entry || !state.staff_clock_policy) {
      throw new Error('Production migration verification failed.');
    }
    console.log(JSON.stringify({ projectRef, versions, state }));
  } finally {
    await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}
