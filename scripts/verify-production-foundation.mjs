// Read-only postcheck for the production 021-023 migration group.
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
if (projectRef !== 'vcjjkaompuriaqybjygm' || dbRef !== projectRef) throw new Error('Project guard failed.');

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
  query_timeout: 20000, statement_timeout: 20000 });
await client.connect();
try {
  await client.query('BEGIN READ ONLY');
  try {
    const history = await client.query(`SELECT version FROM supabase_migrations.schema_migrations
      WHERE version IN ('021','022','023','024','039','041','042') ORDER BY version`);
    const trigger = await client.query("SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) AS definition");
    const index = await client.query("SELECT to_regclass('public.uq_service_runs_one_open_visit') IS NOT NULL AS present");
    const roles = await client.query(`SELECT enumlabel FROM pg_enum
      WHERE enumtypid='public.app_role'::regtype
        AND enumlabel IN ('mowing_crew_lead','mowing_crew_laborer','snow_plow_operator','subcontractor')
      ORDER BY enumlabel`);
    const applied = history.rows.map(row => row.version);
    const definition = trigger.rows[0].definition;
    const expectedRoles = ['mowing_crew_laborer','mowing_crew_lead','snow_plow_operator','subcontractor'];
    if (applied.join(',') !== '021,022,023' || !definition.includes("'invited'") ||
        definition.includes('raw_user_meta_data') || !index.rows[0].present ||
        roles.rows.map(row => row.enumlabel).join(',') !== expectedRoles.join(',')) {
      throw new Error('Production foundation invariant failed.');
    }
    console.log(JSON.stringify({ projectRef, applied, invitedSignup: true,
      uniqueOpenVisitIndex: true, staffRoleValues: roles.rows.length }));
  } finally {
    await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}
