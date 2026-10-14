// Read-only MFA provider/account inventory; never prints identities or keys.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.REDLINE_DATABASE_URL;
if (!url || !key || !connectionString) throw new Error('MFA inventory configuration missing.');
const projectRef = new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const db = new URL(connectionString);
const dbRef = db.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ??
  decodeURIComponent(db.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
if (!projectRef || dbRef !== projectRef) throw new Error('Project mismatch.');

const settingsResponse = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? key },
});
if (!settingsResponse.ok) throw new Error(`Auth settings request failed: ${settingsResponse.status}`);
const settings = await settingsResponse.json();
const mfaSettings = Object.fromEntries(Object.entries(settings)
  .filter(([name]) => /mfa|totp/i.test(name)));

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000,
  query_timeout: 20000, statement_timeout: 20000 });
await client.connect();
let profiles;
try {
  await client.query('BEGIN READ ONLY');
  try {
    profiles = (await client.query(`SELECT id, role::text AS role
      FROM public.profiles WHERE status = 'active' ORDER BY role`)).rows;
  } finally {
    await client.query('ROLLBACK');
  }
} finally {
  await client.end();
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const accounts = [];
for (const profile of profiles) {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: profile.id });
  accounts.push({ role: profile.role, factorListOk: !error,
    verifiedFactors: data?.factors?.filter(factor => factor.status === 'verified').length ?? null });
}
console.log(JSON.stringify({ projectRef, mfaSettings, accounts }, null, 2));
