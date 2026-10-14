// Read-only preparation for applying Redline migrations to a separate staging
// Supabase project. Database credentials are loaded from the ignored .env.local.
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = path.join(root, "supabase", "migrations");

export function validateStagingTarget(connectionString, stagingRef, productionRef) {
  if (!connectionString || !stagingRef || !productionRef) {
    throw new Error("Set REDLINE_STAGING_DATABASE_URL, REDLINE_STAGING_PROJECT_REF and REDLINE_PRODUCTION_PROJECT_REF.");
  }
  if (!/^[a-z0-9]{8,32}$/.test(stagingRef) || !/^[a-z0-9]{8,32}$/.test(productionRef)) {
    throw new Error("Project refs must be Supabase project identifiers.");
  }
  if (stagingRef === productionRef) throw new Error("Staging and production project refs must differ.");
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error("A PostgreSQL URL is required.");
  const direct = url.hostname === `db.${stagingRef}.supabase.co`;
  const pooler = url.hostname.endsWith('.pooler.supabase.com') && url.port === '5432' &&
    decodeURIComponent(url.username) === `postgres.${stagingRef}`;
  if (!direct && !pooler) throw new Error("Database URL does not identify the declared staging Supabase project.");
  if (url.hostname.includes(productionRef) || decodeURIComponent(url.username).includes(productionRef)) {
    throw new Error("Database URL identifies the declared production project.");
  }
  return { projectRef: stagingRef, connectionKind: direct ? 'direct' : 'pooler' };
}

export function roleMappingBlockers(counts, appliedVersions) {
  const blockers = [];
  if (counts.activeUnmappedLegacyRoles) {
    blockers.push('Active legacy roles other than crew_member need an owner-approved mapping.');
  }
  if (appliedVersions.includes('024')) {
    if (counts.activeLegacyCrewMembers) blockers.push('Migration 024 is recorded but active legacy crew_member profiles remain.');
  } else if (counts.activeLegacyCrewMembers !== 1) {
    blockers.push('Migration 024 expects exactly one active legacy crew_member approved as Mowing Crew Laborer.');
  }
  return blockers;
}

async function localMigrations() {
  const names = (await readdir(migrationDir)).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  return Promise.all(names.map(async name => ({
    version: name.slice(0, 3),
    name,
    sha256: createHash('sha256').update(await readFile(path.join(migrationDir, name))).digest('hex'),
  })));
}

async function readCount(client, sql) {
  const { rows } = await client.query(sql);
  return Number(rows[0]?.count ?? 0);
}

export async function inspectStaging(client) {
  await client.query('BEGIN READ ONLY');
  try {
    const { rows: markers } = await client.query(`
      SELECT to_regclass('public.profiles') IS NOT NULL AS profiles,
             to_regclass('public.work_orders') IS NOT NULL AS work_orders,
             to_regclass('public.service_runs') IS NOT NULL AS service_runs,
             to_regclass('public.media_assets') IS NOT NULL AS media_assets,
             to_regclass('public.crew_members') IS NOT NULL AS crew_members,
             to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS history`);
    const marker = markers[0];
    const applied = marker.history
      ? (await client.query('SELECT version FROM supabase_migrations.schema_migrations')).rows.map(row => row.version)
      : [];
    const counts = {};
    if (marker.profiles) {
      counts.activeOwners = await readCount(client,
        "SELECT count(*) FROM public.profiles WHERE status = 'active' AND role::text = 'owner'");
      counts.activeLegacyRoles = await readCount(client, `SELECT count(*) FROM public.profiles
        WHERE status = 'active' AND role::text IN ('administrator','operations_manager',
          'office_manager','estimator','snow_operations_manager','inventory_manager',
          'bookkeeper','read_only','crew_leader','crew_member')`);
      counts.activeLegacyCrewMembers = await readCount(client,
        "SELECT count(*) FROM public.profiles WHERE status = 'active' AND role::text = 'crew_member'");
      counts.activeUnmappedLegacyRoles = counts.activeLegacyRoles - counts.activeLegacyCrewMembers;
    }
    if (marker.service_runs) {
      counts.duplicateOpenVisits = await readCount(client, `SELECT count(*) FROM (
        SELECT work_order_id FROM public.service_runs
        WHERE status IN ('ready','in_progress','paused') AND submitted_at IS NULL
        GROUP BY work_order_id HAVING count(*) > 1) duplicates`);
    }
    if (marker.crew_members && marker.profiles) {
      counts.crewLeaderMismatches = await readCount(client, `SELECT count(*) FROM public.crews c
        WHERE (c.leader_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.crew_members m WHERE m.crew_id = c.id
            AND m.employee_id = c.leader_id AND m.role = 'leader'))
          OR EXISTS (SELECT 1 FROM public.crew_members m WHERE m.crew_id = c.id
            AND m.role = 'leader' AND m.employee_id IS DISTINCT FROM c.leader_id)`);
      counts.ineligibleCrewLeaders = await readCount(client, `SELECT count(*) FROM public.crews c
        JOIN public.profiles p ON p.id = c.leader_id
        WHERE p.status <> 'active' OR p.role::text <> 'mowing_crew_lead'`);
      counts.ineligibleCrewMembers = await readCount(client, `SELECT count(*) FROM public.crew_members m
        JOIN public.profiles p ON p.id = m.employee_id
        WHERE p.status <> 'active' OR
          (m.role = 'leader' AND p.role::text <> 'mowing_crew_lead') OR
          (m.role = 'member' AND p.role::text NOT IN
            ('mowing_crew_lead','mowing_crew_laborer','snow_plow_operator'))`);
    }
    const migrations = await localMigrations();
    const missingBaseline = migrations.filter(m => Number(m.version) <= 20 && !applied.includes(m.version));
    const pending = migrations.filter(m => Number(m.version) >= 21 && !applied.includes(m.version));
    const blockers = [];
    if (Object.values(marker).some(value => value === false)) blockers.push('Required baseline tables or migration history are missing. Reconcile the deployed baseline first.');
    if (missingBaseline.length) blockers.push(`Migration history lacks baseline versions: ${missingBaseline.map(m => m.version).join(', ')}.`);
    if (counts.activeOwners !== 1) blockers.push('Exactly one active owner is required before migration 024.');
    blockers.push(...roleMappingBlockers(counts, applied));
    if (counts.duplicateOpenVisits) blockers.push('Duplicate open visits must be reconciled before migration 022.');
    if (counts.crewLeaderMismatches) blockers.push('Crew leader membership mismatches must be reconciled before migration 028.');
    if (counts.ineligibleCrewLeaders || counts.ineligibleCrewMembers) blockers.push('Inactive or ineligible crew roles must be reconciled before migration 028.');
    return { markers: marker, counts, missingBaseline: missingBaseline.map(m => m.name), pending, blockers };
  } finally {
    await client.query('ROLLBACK');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const localEnvFile = path.join(root, ".env.local");
    if (existsSync(localEnvFile)) process.loadEnvFile(localEnvFile);
    const target = validateStagingTarget(
      process.env.REDLINE_STAGING_DATABASE_URL,
      process.env.REDLINE_STAGING_PROJECT_REF,
      process.env.REDLINE_PRODUCTION_PROJECT_REF,
    );
    const client = new pg.Client({ connectionString: process.env.REDLINE_STAGING_DATABASE_URL,
      connectionTimeoutMillis: 10000, query_timeout: 20000, statement_timeout: 20000 });
    await client.connect();
    try {
      const result = await inspectStaging(client);
      console.log(JSON.stringify({ target, ...result }, null, 2));
      if (result.blockers.length) process.exitCode = 2;
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Staging preflight failed.');
    process.exitCode = 1;
  }
}
