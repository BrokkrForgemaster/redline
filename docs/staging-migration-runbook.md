# Staging migration rehearsal

This earlier staging procedure remains available for a future rehearsal. The owner selected a direct production path on October 12; its current sequence is in `docs/production-rollout-proposal.md`. Supabase CLI 2.120.0 is pinned in `package.json`. The repository now has numbered migration files through `042`, with `038` intentionally unused so private storage runs after the compatible application deployment.

## Required access and evidence

- A staging database connection URL, staging project ref, and production project ref set as `REDLINE_STAGING_DATABASE_URL`, `REDLINE_STAGING_PROJECT_REF`, and `REDLINE_PRODUCTION_PROJECT_REF`. Add these to the existing ignored `.env.local` in the repository root. Do not commit it or put passwords in chat. The staging preflight reads that file and rejects a URL naming the declared production project.
- A staging copy of the actual deployed database baseline, including Auth and migration history. Capture the deployed migration list, trigger definitions, RLS and storage policies, grants, and row counts. A new empty project cannot pass migration 024's exactly-one-active-owner precondition without a controlled owner setup.
- Independently restorable database **and** storage-object backups with manifests and checksums. Confirm a staging restore before migration. A database dump alone cannot restore photos.
- Supported Node 22, locked `npm ci`, and staging Supabase Auth/Storage configuration. Node 22.23.3 is installed on this workstation and the local checks below passed under it. The Docker database is unavailable, so a staging database is still required for the SQL rehearsal.

## Inspect without changing the database

Add these keys with actual values to the existing `.env.local`; URL-encode reserved characters in the database password:

```dotenv
REDLINE_STAGING_DATABASE_URL=postgresql://postgres.STAGING_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres
REDLINE_STAGING_PROJECT_REF=STAGING_REF
REDLINE_PRODUCTION_PROJECT_REF=PRODUCTION_REF
```

From the repository root:

```powershell
node scripts/staging-migration-preflight.mjs
```

The guarded CLI wrapper reads `.env.local`, repeats the staging target and data preflight, and invokes the pinned CLI without `--yes` or seed flags:

```powershell
node scripts/staging-migration-cli.mjs list
node scripts/staging-migration-cli.mjs dry-run
```

The preflight is read-only and prints only project ref, table presence, counts, migration filenames and SHA-256 values. It fails if the baseline history is missing, the active owner count is not one, any unmapped active legacy role remains, the approved single legacy crew member count changes, open visits conflict with migration 022, or crew leader membership conflicts with migration 028. Compare its output with independently captured deployed history. Do not use `migration repair` to silence a mismatch without proving which SQL ran; Supabase records applied versions in `supabase_migrations.schema_migrations`.

Production read-only inventory on October 12 found recorded versions `006`–`012` and `014`–`017`; history lacks `001`–`005`, `013`, and `018`–`020`. Some corresponding objects or settings are present, so missing history does not prove the SQL was never run. The deployed time-entry update policy has no explicit `WITH CHECK`, so migration 013's correction is absent. Reconcile each missing version against a schema export, policies, storage settings, publication membership, and seed rows in a restored staging copy. Repair history only for independently proven equivalents; apply any genuinely missing change as a reviewed additive migration. A plain `db push` against this history is unsafe because it would attempt baseline schema creation again.

Review the pending migration list after history reconciliation. Inspect each SQL file and the backup before applying. Migration 024 contains the owner's October 12 decision to map exactly one active `crew_member` to `mowing_crew_laborer`, with an audit record; it aborts if that count or other legacy roles differ. Migration 028 protects current crew membership. Migration `042` makes legacy job photos private and removes broad direct evidence/gallery storage writes; deploy the compatible signed-photo application code before applying `042` to production. Resolve preflight findings through reviewed, auditable data corrections, not by disabling RLS or deleting history.

## Apply to staging after preflight passes

```powershell
node scripts/staging-migration-cli.mjs apply
node scripts/staging-migration-cli.mjs list
node scripts/staging-migration-preflight.mjs
```

Do not use `--yes`, `--include-seed`, `db reset --linked`, or a production connection URL. If a migration fails, stop; capture the error and current migration history. Do not rerun blindly or modify an already applied file. Confirm the affected transaction and data before writing an additive correction migration.

After applying, compare before/after counts for customers, properties, jobs, work orders, visits, assignments, media, and alerts. Test signup-trigger least privilege, last-owner protection, direct and crew/company RLS, private storage, owner MFA, concurrent visit commands, upload completion races, and queue recovery with staging accounts. For migration `042`, verify that public legacy photo URLs fail, assigned workers can obtain signed links, reassigned/inactive/developer accounts cannot, signed uploads still work, and approved public gallery images remain visible. Confirm the new functions and policies exist and that inactive, wrong-role and wrong-scope callers fail. Rehearse application rollback only while both releases understand the additive schema; migration `042` also requires the signed-photo app release because an older release expects public URLs. If database restore is required, freeze writes, restore database and objects separately, then reconcile Auth state, invitations, media metadata and delivery jobs before resuming.

Production deployment and migration remain separate approval steps after a successful rehearsal and an exact release commit are recorded.
