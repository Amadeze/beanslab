# HANDOFF — Final QA / Production Readiness

Last updated: 2026-09-01

> See `docs/AUDIT_INDEX.md` for the current authoritative document set. Stale audits from 2026-07-29 live in `docs/archive/2026-07-29/`.

## Current state

| Field | Value |
|---|---|
| Branch | `wip/non-kopi-commit3` (referenced by prior handoff; current local branch is `main`) |
| Local commits ahead of origin | 0 after release synchronization |
| Batch 6.5 / 7 / 8 | **CLOSED + PUSHED** |
| Final Product Coherence | **CLOSED + PUSHED** |
| Final QA closure | **APPLICATION + LIVE TARGET GATES CLOSED** |
| Application release candidate | **DEPLOYED TO PRODUCTION** |
| Production deployment | **RECOVERY GATE PARTIALLY EVIDENCED — full evidence still requires repository secrets** |
| Workspace cleanup (2026-08-31) | **APPLIED — stray files removed, .gitignore + tsconfig + eslint tightened, stale docs archived** |
| Local restore-drill (2026-09-01) | **PASS — pipeline executed end-to-end on a self-contained local PG 17 cluster** |

The release branch is pushed and deployed. Live readiness, migrations, storage, Supabase Data API isolation, and scheduled operations have target evidence. Production approval is withheld solely because recovery and destructive-pilot evidence are incomplete on the Supabase Free plan.

The repository now includes a no-plan-upgrade recovery path: a daily encrypted `pg_dump`, automated disposable restore drill, 30-day private artifact retention, and `docs/DATABASE_RECOVERY.md`. It is intentionally not counted as recovery evidence until its GitHub secrets are configured and a successful artifact is independently downloaded and restored.

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

- `BACKUP_DATABASE_URL` and `BACKUP_ENCRYPTION_PASSPHRASE` are still not configured in GitHub Actions. The cryptographic and restore contracts have now been exercised end-to-end on a self-contained local cluster (`docs/DATABASE_RECOVERY.md` "Local restore-drill evidence (2026-09-01)" and `docs/recovery-evidence/2026-09-01-local-drill/run.md`); what remains is the *production* evidence, which requires the two repository secrets and one workflow run against the Supabase URL.
- Do not execute the destructive golden pilot until production recovery evidence exists. After backup/upgrade, run the pilot and provider transaction smoke, then record final approval.

## Go/no-go interpretation

- **Code/application:** deployed and accepted.
- **Production target:** live health/storage/migration/security/scheduler gates pass; final approval is withheld until backup/restore and the post-backup pilot pass.

## Workspace cleanup (2026-08-31)

An audit pass was applied without touching migrations, secrets, or any deployed code path:

- Removed `__dream_query.py` and `system_prompt.txt` from the repo root.
- Added `/desktop/dist/`, `/desktop/src-tauri/target/`, stray scratch files, `/tools/pending-merge-from-roastd-main/`, and `/docs/recovery-evidence/*/` to `.gitignore`. Removed the existing `desktop/dist/` from the working tree.
- Excluded `roastd-studio-gpl/` and Tauri build output from `tsconfig.json` and `eslint.config.mjs` so Qt translator `.ts` files and Tauri codegen assets no longer pollute typecheck and lint.
- Archived the 2026-07-29 audit documents to `docs/archive/2026-07-29/` and added `docs/AUDIT_INDEX.md` as the index of authoritative vs historical docs.
- Verified the three previously open P0 risks against current code: `src/lib/midtrans-environment.ts` uses the `SB-` prefix for sandbox detection; `src/proxy.ts` keeps `'unsafe-inline'` in `script-src` for development only and uses nonce-only in production; Studio quit lifecycle uses an `isQuitting` flag in the bundled output. No code change was required for those items.
- The sibling folder `F:\programming\roastd-main` is **not** a duplicate. It is the `refactor/ux-operational-workflows` working tree (unique commit `dc9ed98`, 23 files, +553/−435). It was left in place with `DO_NOT_DELETE.txt`. Four files unique to that branch that `main` does not import were copied to `tools/pending-merge-from-roastd-main/` for review.

## Local restore-drill (2026-09-01)

See `docs/DATABASE_RECOVERY.md` (section “Local restore-drill evidence”) and `docs/recovery-evidence/2026-09-01-local-drill/run.md`. The pipeline ran against a fresh PostgreSQL 17 cluster, applied migrations 000–012, produced a custom-format dump, verified the catalogue, restored with `--exit-on-error`, ran the canonical verification queries, encrypted with AES-256-CBC + PBKDF2 (250k iterations), decrypted, and restored from the decrypted dump into a second target. All steps passed.

## Do not

- Touch `information_architecture_audit.md`.
- Modify migrations 000–004.
- Push without explicit authorization.
- Treat the test-only local storage root or E2E provider secret as production configuration.
- Delete `F:\programming\roastd-main`. It is a feature-branch working tree, not a stale clone.
