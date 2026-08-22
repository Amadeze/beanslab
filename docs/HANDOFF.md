# HANDOFF — Final QA / Production Readiness

Last updated: 2026-08-22

## Current state

| Field | Value |
|---|---|
| Branch | `wip/non-kopi-commit3` |
| Local commits ahead of origin | 0 (`83bb335` is synchronized with origin) |
| Batch 6.5 / 7 / 8 | **CLOSED + PUSHED** |
| Final Product Coherence | **CLOSED + PUSHED** |
| Final QA closure | **LOCAL GATES CLOSED + PUSHED** |
| Application release candidate | **LOCAL GATES PASS** |
| Production deployment | **NO-GO — TARGET ENVIRONMENT BLOCKERS REMAIN** |

The release-candidate history through `83bb335` is pushed. The production target remains blocked by environment evidence, not by unpublished application commits.

## Final QA delivered

- Provisioned an isolated local PostgreSQL 18 cluster on `127.0.0.1:55432`; no production database was used.
- Applied migrations 000–005 to three fresh disposable databases through the guarded migration command.
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

- `prisma:migrate:deploy`: PASS — all 6 migrations applied.
- `prisma migrate status`: PASS — database up to date.
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: PASS — no difference.
- Migrations 000–004 remain byte-for-byte untouched.
- Migration 005 is accepted locally but still requires target deployment verification.

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

## Target-environment no-go blockers

- The checked-in local `.env.local` state uses documented placeholder endpoints, so it is not target-environment evidence. `preflight:production` must be rerun from the deployment secret manager with real database and Supabase configuration.
- `RAJAONGKIR_API_KEY`, real Midtrans sandbox keys, `RESEND_API_KEY`, `WA_API_KEY`, and Xendit credentials are absent. Internal contracts pass, but real provider smoke tests cannot be performed without those credentials.
- Email, WhatsApp, SaaS subscription Midtrans, and Xendit are disabled. Optional channels require an explicit launch decision; private proof storage is not optional.
- Migrations 003–005, backup/PITR, restore drill, health endpoints, scheduled jobs, and the golden pilot workflow still require verification in the intended deployment environment.

## Go/no-go interpretation

- **Code/application:** ready as a local release candidate.
- **Production target:** no-go until private storage, target migrations, backup/restore, required providers, and post-deploy smoke evidence pass.

## Do not

- Touch `information_architecture_audit.md`.
- Modify migrations 000–004.
- Push without explicit authorization.
- Treat the test-only local storage root or E2E provider secret as production configuration.
