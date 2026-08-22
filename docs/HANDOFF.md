# HANDOFF — Final QA / Production Readiness

Last updated: 2026-08-22

## Current state

| Field | Value |
|---|---|
| Branch | `wip/non-kopi-commit3` |
| Local commits ahead of origin | 0 after release synchronization |
| Batch 6.5 / 7 / 8 | **CLOSED + PUSHED** |
| Final Product Coherence | **CLOSED + PUSHED** |
| Final QA closure | **APPLICATION + LIVE TARGET GATES CLOSED** |
| Application release candidate | **DEPLOYED TO PRODUCTION** |
| Production deployment | **RECOVERY GATE NO-GO — SUPABASE FREE HAS NO MANAGED BACKUP/PITR** |

The release branch is pushed and deployed. Live readiness, migrations, storage, Supabase Data API isolation, and scheduled operations have target evidence. Production approval is withheld solely because recovery and destructive-pilot evidence are incomplete on the Supabase Free plan.

## Final QA delivered

- Provisioned an isolated local PostgreSQL 18 cluster on `127.0.0.1:55432`; no production database was used.
- Applied migrations 000–005 to three fresh disposable databases through the guarded migration command, then verified the complete 000–006 chain on a fourth fresh target.
- Fixed purchase void correctness so a voided purchase atomically clears `paidAmount` and resets `paymentStatus` to `UNPAID`; audit before/after snapshots include the payment fields.
- Updated stale finance integration fixtures for the enforced CREDIT due-date invariant.
- Made authenticated E2E sessions include `sessionVersion` and made the seed tenant test-ready without hardcoded merchant identities.
- Kept E2E proof uploads local through an explicit test-only storage root, even when placeholder Supabase variables exist. Production storage behavior is unchanged.
- Updated release E2E tests to use public checkout identifiers, canonical labels, current theme tokens, registry-era navigation, and self-contained tenant/superadmin fixtures.
- Made the subscription webhook contract test self-contained with an E2E-only secret.
- Pinned ExcelJS's compatible `uuid` dependency to patched 11.1.1 and verified real XLSX creation/parsing.
- Production preflight rejects the documented placeholder endpoints/secrets before network access and emits only key-level diagnostics.
- The release Playwright runner uses an isolated port, refuses unrelated-server reuse, and fails fast when its local database has not been seeded.
- The historical AWB cold-import timeout is isolated with a test-specific timeout; behavior assertions are unchanged.

## Database and migration evidence

Fresh database acceptance:

- `prisma:migrate:deploy`: PASS — all 7 migrations applied.
- `prisma migrate status`: PASS — database up to date.
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: PASS — no difference.
- Migrations 000–004 remain byte-for-byte untouched.
- Migrations 000–005 are verified in production with no failed or pending release migration; the final deployment records migration 006 after its emergency SQL-equivalent remediation was verified live.
- Migration 006 enables RLS on all application tables and revokes current/default Data API privileges from `PUBLIC`, `anon`, and `authenticated`.

Database-backed audits on the disposable target:

- Tenant isolation: PASS for isolated reads/grouping, rejected cross-tenant update/relation, and transaction scoping.
- Stock audit: PASS — no product or packaging drift.
- Data integrity audit: PASS — no violations.

## Validation evidence

| Gate | Result |
|---|---|
| `prisma validate` / `prisma generate` | PASS |
| `typecheck` / `eslint --quiet` | PASS |
| Focused finance regression | 76/76 PASS |
| Full integration-enabled suite, serial | 150 files; 1,345/1,345 PASS; 0 skipped |
| XLSX + private-storage focused regression | 12/12 PASS |
| Production build | PASS; 68 pages |
| Full production-server Playwright suite | 31/31 PASS; 0 skipped |
| Checkout/payment/webhook contracts | PASS, including partial proof, overpayment rejection, idempotency, subscription terminal state, and Artisan DROP |
| Theme compatibility | PASS across all tenant storefront theme layouts |
| Dependency audit | 0 critical, 1 high, 0 moderate |

## Remaining dependency risk

`deepmerge-ts <8` remains through `@prisma/config` in Prisma 7.9.1, which is the latest available Prisma release. The vulnerable recursive-graph behavior is not reachable from untrusted application input here; it merges trusted Prisma configuration. Do not force an unsupported major override. Record explicit risk acceptance for release and upgrade when Prisma publishes a compatible dependency.

## Live target evidence

- Vercel liveness and readiness: HTTP 200; database reachable.
- Supabase project: ACTIVE_HEALTHY in `ap-south-1`; public/private buckets reachable; private bucket confirmed non-public.
- Publishable-key Data API probe originally exposed tenant data; emergency RLS/revoke remediation is applied and repeat probes return HTTP 401.
- One unrecoverable legacy tenant Midtrans ciphertext was preserved in an audit entry and the broken tenant gateway configuration was disabled.
- GitHub `ROS Daily Operations` holds synchronized production secrets and a manual release run completed readiness, subscriptions, payment expiry, overdue reminders, daily brief, and cleanup successfully; Vercel logged every cron request as HTTP 200.
- Email, WhatsApp, and RajaOngkir are explicitly disabled for initial launch. Platform subscription Midtrans is configured; provider transaction smoke remains controlled-rollout work.

## Remaining no-go blocker

- Supabase organization plan is Free. Current Supabase documentation provides managed daily backups only for Pro/Team/Enterprise and PITR only as a paid add-on. No verified off-site logical dump or restore drill exists yet.
- Do not execute the destructive golden pilot until recovery evidence exists. After backup/upgrade, run the pilot and provider transaction smoke, then record final approval.

## Go/no-go interpretation

- **Code/application:** deployed and accepted.
- **Production target:** live health/storage/migration/security/scheduler gates pass; final approval is withheld until backup/restore and the post-backup pilot pass.

## Do not

- Touch `information_architecture_audit.md`.
- Modify migrations 000–004.
- Push without explicit authorization.
- Treat the test-only local storage root or E2E provider secret as production configuration.
