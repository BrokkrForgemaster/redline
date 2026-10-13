// Guarded staging-only entry point for Supabase migration history/dry-run/apply.
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { inspectStaging, validateStagingTarget } from './staging-migration-preflight.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
if (!['list', 'dry-run', 'apply'].includes(mode)) {
  console.error('Usage: node scripts/staging-migration-cli.mjs <list|dry-run|apply>');
  process.exitCode = 1;
} else {
  try {
    const envFile = path.join(root, '.env.local');
    if (existsSync(envFile)) process.loadEnvFile(envFile);
    const connectionString = process.env.REDLINE_STAGING_DATABASE_URL;
    const target = validateStagingTarget(connectionString,
      process.env.REDLINE_STAGING_PROJECT_REF,
      process.env.REDLINE_PRODUCTION_PROJECT_REF);
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
      query_timeout: 20000, statement_timeout: 20000 });
    await client.connect();
    let report;
    try { report = await inspectStaging(client); }
    finally { await client.end(); }
    if (report.blockers.length) throw new Error(`Staging preflight blocked: ${report.blockers.join(' ')}`);
    console.log(`Target: staging project ${target.projectRef}; pending migrations: ${report.pending.map(m => m.version).join(', ') || 'none'}.`);
    const args = mode === 'list' ? ['migration', 'list'] :
      ['db', 'push', '--skip-vault', ...(mode === 'dry-run' ? ['--dry-run'] : [])];
    args.push('--db-url', connectionString);
    const cli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
    const child = spawn(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit' });
    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', code => resolve(code ?? 1));
    });
    process.exitCode = exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Staging migration command failed.');
    process.exitCode = 1;
  }
}
