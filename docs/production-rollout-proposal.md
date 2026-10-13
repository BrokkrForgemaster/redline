# Direct production rollout proposal

Owner direction on October 12, 2026: deploy to live production without a staging rehearsal. This supersedes the preferred staging sequence in the implementation plan, but it does not establish the live/device acceptance evidence that staging would have provided. Only the separately authorized time-entry migration `013` has been applied to production. No application deployment, provider change, or notification delivery has been performed under this proposal.

## Verified starting point

- Production project: `vcjjkaompuriaqybjygm`. The Session pooler URL in ignored `.env.local` connects to the same project as `NEXT_PUBLIC_SUPABASE_URL`; read-only inventory succeeded. The service-role JWT added October 12 passed a read-only Storage API request and is aliased locally to the application's `SUPABASE_SERVICE_ROLE_KEY` name.
- The linked Vercel project is `brokkrforgemasters-projects/redline`. The CLI is authenticated, and production has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` variables. Vercel project settings currently select Node 24.x, while `package.json` requires Node `>=20.9 <23` and `.nvmrc` selects 22. Set the production project to Node 22 before deployment and rebuild.
- The current deployment serving `www.redlinelandscapingky.com` and `redlinelandscapingky.com` is `dpl_93eqSgWPMmBsRtEmDt9dZNKaGVDw` (Ready, October 11). Retain this deployment for application rollback. The Vercel inspection did not expose a Git commit SHA, so compatibility must be checked from the actual deployed behavior.
- Recorded database migrations are `006`–`012` and `014`–`017`. History omits `001`–`005`, `013`, and `018`–`020`; some corresponding objects/settings exist. The deployed time-entry update policy does not contain migration 013's explicit `WITH CHECK`. A blanket `supabase db push` would try baseline migrations again and is prohibited.
- Migration `013` was applied to production October 12 after a local database and object snapshot, with transactional policy verification. Pending local migrations are `021`–`037`, `039`–`042`. Production has one active owner, one active developer, and one active legacy `crew_member`; the owner selected Mowing Crew Laborer for that account. Current retained table counts are zero for customers, properties, jobs, job photo rows, work orders, service runs, media assets, and notifications. Storage has one avatar and six job-photo objects; the latter have no matching `job_photos` metadata rows and must still be preserved.
- Production currently permits broad authenticated private evidence access, broad gallery writes, and public legacy job-photo reads. Migration `042` tightens these boundaries and makes legacy job photos private. The compatible application must serve authorized signed URLs before this change.
- A local PostgreSQL archive and all seven objects were captured with checksums. `pg_restore --list` passed, but no restore was rehearsed and no independent encrypted copy is configured. This is a recovery gap for a broader migration.
- All three existing active accounts currently have zero verified TOTP factors. The compatible website will require enrollment and a verified first code before staff access. TOTP is documented by Supabase as enabled by default, but this project's enrollment/challenge configuration and live account flows have not been exercised.
- Local Node 22.23.3 checks after the current edits: 70 tests passed, TypeScript passed, lint had zero errors and ten warnings, and build passed. SQL, deployed Auth/RLS, and device flows remain untested.

## Required preparation before a live write

1. Copy the local database and seven-object snapshot to an independently controlled encrypted location and verify restoration. Take a fresh snapshot before the larger cutover. Supabase database backups alone do not include object bytes.
2. Read-only diff each omitted historical migration against the deployed schema. Mark a version applied only when all effects are proven equivalent. Migration `013` is now applied and recorded; leave its history intact. Record pre-change policies and function definitions needed for rollback.
3. Confirm the production domain, Vercel deployment alias and environment values without disclosing secrets. Set the project runtime to supported Node 22. Add server-only `REDLINE_PORTAL_URL=https://www.redlinelandscapingky.com` to production and allow the matching `/auth/callback` redirect in Supabase Auth before sending invitations. The existing `NEXT_PUBLIC_SITE_URL` points to a WordPress host and must not be used for Auth callbacks. Capture the current deployment ID for application rollback.
4. Inspect migrations `021`–`037`, `039`–`042` against the production catalog and row counts immediately before execution. Stop on any changed precondition, including role count or schema drift. Test provider TOTP enrollment/challenge and email redirect configuration with authorized accounts; no production test invitation or notification has been sent.

## Ordered production change, requiring separate approval

1. Freeze new operational writes for the brief cutover and take fresh database and object backups. Keep the public website available if possible; communicate a field-operation pause to staff before disabling writes.
2. Reconcile migration history only for proven equivalents, then apply reviewed additive migrations `021`–`037` and `039`–`041` in order. Check each version and invariant after commit. Do not run seeds, retention purges, or destructive cleanup.
3. Deploy the locally validated application with supported Node 22 and the existing production server-side Supabase key and portal URL. Verify login, MFA enrollment/challenge, dashboard, owner and laborer scopes, private media signed reads/writes, gallery, and public inquiry behavior using controlled accounts. Do not trigger production push/email test deliveries without separate authorization.
4. Apply migration `042` only after the compatible application serves authorized legacy photo links. Verify old public photo URLs are denied, assigned users can obtain signed links, unauthorized users cannot, and public approved gallery media still works. Inspect storage policies and object counts after the change.
5. Unfreeze operations, monitor errors, queue/delivery state, and role access. Keep the previous Vercel deployment and pre-change database/object backups until rollback window closure. Record exact deployed migration versions, application deployment ID, and post-change reconciliation counts.

## Rollback and stopping rules

- Stop immediately on any backup failure, changed owner/legacy-role count, missing historical equivalence, migration error, wrong environment, failed privileged path, or unexplained object-count change.
- Revert the application to the captured deployment only while its code remains compatible with the expanded schema and private storage setting. A rollback before migration `042` may be possible without reversing storage visibility. After `042`, restoring public legacy reads is a security regression; prefer fixing signed delivery or freezing field operations while resolving it.
- Do not run destructive down migrations. If database restore is necessary, freeze writes and restore the database and object bytes as separate operations, then reconcile Auth sessions, invitations, storage metadata, queued field operations, and worker deliveries before reopening. A database restore alone is insufficient.

## Still unverified after a direct rollout

Real phone camera/GPS/offline/push behavior, two-account and concurrent-device field flows, provider MFA recovery, deployed signup trigger, RLS/storage edge cases, and backup/object restore timing remain release risks until observed. The direct production preference does not convert source or local test evidence into those results.
