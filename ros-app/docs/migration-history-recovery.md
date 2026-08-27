# Migration History Recovery

Status: **implemented and acceptance-tested locally** (fresh deploys x2, verify-branch
replay, guard tests, baseline reproducibility). No commit has been made; see the
final report for the verdict.

## 1. Problem

The Prisma migration history of this repository was rewritten at commit `378201a`
(2026-07-30): 20 migration directories became 41. Three files in the rewritten
history were born with UTF-16 encoding (embedded NUL bytes) and never worked:

| Migration | NUL bytes | Extra junk |
|---|---|---|
| `20260727080000_add_gap_audit_fixes` | 2402 | — |
| `20260727090000_add_indonesian_localization` | 1425 | 1 dotenvx banner line |
| `20260727100000_add_compliance_and_notifications` | 228 | 1 dotenvx banner line |

Because `prisma migrate status` (and any fresh deploy) replays the history
from scratch, these files make the history unusable. Additionally, DDL for
several tables and columns exists in `schema.prisma` but never existed in ANY
commit of the migration history (see section 3), so a replay of the old
history — even if repaired — could never converge to the schema.

## 2. Approach (HYBRID)

1. **`000000000000_baseline`** — full schema snapshot generated from the
   CURRENT working-tree `schema.prisma` via
   `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`.
   On fresh databases this is the first migration.
2. **`000000000001_preserve_domain_invariants`** — manually authored migration
   that recreates the custom database invariants from the old history that
   Prisma cannot express in `schema.prisma` (CHECK constraints, a partial
   unique index) and that remain valid for the current schema.
3. Future migrations append normally after these two.

The old history is NOT deleted from the repository: Git retains it. There is no
`migrations-archive/` directory — recovery notes live in this document.

## 3. What the baseline contains (and why it is safe)

The baseline (2916 lines) was verified to contain everything that the old
history could never deliver:

- **Missing DDL** (present in `schema.prisma`, never in any old migration):
  `journal_entries`, `journal_lines`, `roasts`, `purchase_orders`,
  `purchase_order_items`, `accounts`, `credit_notes`, `credit_note_items`,
  `budgets`, `onboarding_snapshots` (the old history only had a no-op
  migration `20260720222800`).
- **Repaired FKs** that only ever existed in the reverted commit `d19270f`:
  `parent_roasting_batches_machineId_fkey`,
  `child_roasting_batches_roastId_fkey`.
- **Phase 2H Batch 1 objects**: `portal_themes` (with
  `portal_themes_tenantId_fkey ... ON DELETE CASCADE`) and the
  `SalesChannel` enum value `STOREFRONT` — the two untracked Batch 1 migration
  directories were absorbed into the baseline and are intentionally NOT
  active migrations anymore.
- Canonical index names, e.g.
  `roast_material_reservations_parentBatchId_lotId_sourceLocat_key`.

The baseline does NOT contain `zzz_persist_test` (a leftover table in the
canonical `public` schema) and does NOT contain the partial index
`live_sessions_active_unique` (that one is preserved manually — section 4).

## 4. Preserved domain invariants

`000000000001_preserve_domain_invariants` is a manual migration. Machine-derived
manifest: `scripts/migration-recovery/invariant-manifest.json` (23 CHECK
constraints found in the old history by two independent scans; 18 preserved).

**Preserved (18 CHECK constraints)** — verbatim expressions from the old
migration SQL, applied only if absent, and never blindly trusted when present
(canonical definition comparison via a throwaway temp table; any difference
aborts the migration):

- `products_stock_nonnegative`, `packagings_stock_nonnegative`
- `roasting_target_positive`, `roasting_output_valid`,
  `roasting_completed_has_output`
- `production_values_positive`
- `invoice_item_values_valid`, `invoice_values_valid`
- `payment_amount_positive`, `expense_amount_positive`
- `supplier_payment_amount_positive`
- `purchase_payment_values_valid`, `purchase_credit_requires_due_date`,
  `void_purchase_has_no_payment_balance`
- `cupping_scores_range_check`
- `contract_prices_quantity_check`, `contract_prices_value_check`
- `tenant_payment_methods_manual_shape_check`

**Partial unique index** `live_sessions_active_unique` (on
`live_sessions(tenantId, machineId) WHERE status = 'ACTIVE'`) — created only
after a duplicate-ACTIVE preflight; an existing index with a different
definition aborts.

**Data precheck** — `journal_entries` duplicate
`(tenantId, refType, reference)` detection (fail-fast when the unique index is
absent, e.g. during adoption of an existing database).

**NOT preserved (5 obsolete invariants)** — each verified against the current
`schema.prisma` and the canonical database:

| Constraint | Why obsolete |
|---|---|
| `profit_distribution_values_valid` | table `profit_distributions` removed from the schema (finance refactor; folded into `CapitalTransaction`) |
| `withdrawal_requires_partner` | column `partnerId` removed from `capital_transactions` |
| `capital_transaction_amount_positive` | `amount` is now signed: negative for WITHDRAWAL/DIVIDEND (documented in `schema.prisma`); `amount > 0` would reject withdrawals |
| `inventory_ledger_exactly_one_target` | SUPPLY cutover added `supplyItemId`; supply entries legitimately have both `productId` and `packagingId` NULL |
| `inventory_ledger_exactly_one_positive_quantity` | supply entries use `supplyQuantity` with `quantityKg`/`quantityUnit` both NULL |

The studio `artisan_connectors.authorizedByUserId` FK DO-block is also NOT
repeated: the relation is representable in `schema.prisma` and is emitted by
the baseline.

## 5. Adoption for an existing database

For the canonical/local database (which has NO `_prisma_migrations` table and
no CHECK constraints):

1. Apply the baseline SQL to the target schema
   (`psql -f prisma/migrations/000000000000_baseline/migration.sql`), then
   `prisma migrate resolve --applied 000000000000_baseline`.
2. `prisma migrate deploy` runs only
   `000000000001_preserve_domain_invariants` — it validates existing rows when
   adding each CHECK (a violation fails the deploy with a precise error, no
   automatic repair).
3. If old `_prisma_migrations` rows exist (state B), resolve the baseline and
   record Prisma 7.9's actual behavior; do NOT hand-edit `_prisma_migrations`.

Read-only backfill preflight (`scripts/migration-recovery/backfill-preflight.mjs`,
`pnpm preflight:backfill`): PASS/NEEDS BACKFILL + row counts, exit 0/1, NO data
mutation. Coverage:

- all 18 preserved CHECK invariants (count of rows that would violate them),
- the two index prechecks (`live_sessions_active_unique` duplicate ACTIVE
  groups, `journal_entries` duplicate `(tenantId, refType, reference)` groups),
- five historical one-time data backfills:
  - `supplier_payments_legacy` — COMPLETED purchases with `totalCost > 0`
    lacking a supplier payment (20260716223000),
  - `source_green_bean_lineage` — ROASTED_BEAN with `sourceGreenBeanId` that
    does not point at a same-tenant GREEN_BEAN (20260719152000),
  - `cupping_session_code` — `cupping_sessions.code` NULL/empty (20260727150000),
  - `coffee_identity` — GREEN_BEAN without `coffeeSourceId`, or lineage-proven
    ROASTED_BEAN without `coffeeSourceId`/`materialOrigin` (20260810160000),
  - `storefront_grind_options` — `recipes.storefrontGrindOptions` NULL
    (20260810153000),
- `authorized_by_user_id` (20260728190000) is reported SKIP/obsolete: the
  `artisan_connectors` table no longer exists in the schema.

## 6. Verification performed (local, disposable schemas)

- Fresh deploy x2 on unique `ros_test` schemas: exactly 2 migrations applied,
  `migrate status` clean, `migrate diff` empty.
- Physical assertions: 18 CHECKs present with matching definitions, partial
  index predicate `WHERE (status = 'ACTIVE'::"LiveSessionStatus")`,
  `journal_entries_tenantId_refType_reference_key`, portal_themes FK CASCADE,
  STOREFRONT, all missing-history tables, both repaired FKs, canonical index
  name, `_prisma_migrations` = exactly the 2 migrations.
- Idempotency replay: the preserved migration re-run on a deployed schema
  passes (verify branch). Negative test: a tampered constraint definition
  aborts with `... exists with a DIFFERENT definition`.
- Baseline reproducibility: `migrate diff --from-empty` regenerates a
  byte-identical file.
- Preflight acceptance: ALL PASS (exit 0) on the canonical `public` database
  and both acceptance schemas. Detection proven with a poisoned baseline-only
  schema: one row with negative `packagings.stockUnit` → `NEEDS BACKFILL
  packagings_stock_nonnegative: 1 violating row(s)` + exit 1.
- Test-DB guard (`test/setup/test-database-guard.ts`): `TEST_DATABASE_URL` is
  required and must never equal `DATABASE_URL`/`DIRECT_URL` from `.env.local`
  (the development/production pointer) and must be a local host. A local
  `DATABASE_URL` in the process environment is the normal local convention —
  the shared `@/lib/prisma` singleton reads it directly — so the process-env
  values are allowed to equal the test URL; `test/setup/vitest.global.ts`
  additionally refuses integration runs when the process `DATABASE_URL`/
  `DIRECT_URL` are not local (singleton safety). Guard covered by 10 unit
  tests (`src/lib/test-database-guard.unit.test.ts`); the integration suites
  use the shared resolver.
- Integration-run convention (all 125 test files green):
  `RUN_INTEGRATION=true` + `DATABASE_URL=<local test url>` +
  `TEST_DATABASE_URL=<local test url>`, run with `--no-file-parallelism`
  (parallel file execution deadlocks on the shared local database).
- Test adaptations required by the recovery: `src/lib/lot-opname.test.ts`
  static checks now read the baseline instead of the deleted
  `20260808190000_add_location_transfer`/`20260809200000_add_location_opname`
  files; `src/lib/coffee-identity-migration.integration.test.ts` carries the
  historical backfill SQL as an inline fixture (the migration itself is no
  longer a file).
- Adoption simulations on disposable schemas:
  - **State A** (populated, no `_prisma_migrations`): baseline applied via
    psql → `resolve --applied` → deploy runs ONLY the preserved migration →
    status up to date, 18 CHECKs, 2 history rows.
  - **State B** (old history rows retained): 3 old rows left untouched,
    baseline resolved applied, deploy applies only the preserved migration —
    Prisma 7.9 tolerates extra history rows, no `_prisma_migrations` surgery.
  - **State C** (failed baseline row): `resolve --rolled-back` → deploy
    replays baseline + preserved → clean.
  - **State D** (schema migrated, no history): `migrate status` reports the
    two migrations as not yet applied (drift signal); the preflight then
    reports data violations (if any) and stops adoption.
- Disposable acceptance schemas were dropped after verification.

## 7. Retrieving the old history

The old 70 migration directories are removed from the working tree but remain
in Git history at `HEAD` (their deletion is part of the uncommitted recovery
work). Any old file can be retrieved with:

```sh
git show HEAD:prisma/migrations/<directory>/migration.sql
```

`prisma/migrations/portal-theme-migration.ts` (a committed data-conversion
script, not a Prisma migration) is intentionally untouched.