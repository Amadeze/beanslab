# HANDOFF — Batch 4 AWB / Tracking

Last updated: 2026-08-21

## Current State

| Field | Value |
|---|---|
| Implementation HEAD | Batch 4 commit (pending) |
| Branch | `wip/non-kopi-commit3` |
| Batch 4 status | **CLOSED + PUSHED** |

## Batch 4 WIP Summary

All Batch 4 application code changes are uncommitted on `wip/non-kopi-commit3`.

Files changed (uncommitted):

- `prisma/schema.prisma` — added InvoiceTracking model + Invoice/Tenant relations
- `prisma/migrations/000000000004_storefront_awb_tracking/migration.sql` — CREATE TABLE, indexes, FKs
- `src/lib/shipping/tracking.ts` — normalization types + normalizeTrackingEvent/Response
- `src/lib/shipping/tracking.test.ts` — 12 normalization tests
- `src/lib/shipping/providers/rajaongkir.ts` — added trackWaybillDetailed()
- `src/lib/shipping/providers/rajaongkir.test.ts` — 4 new trackWaybillDetailed tests
- `src/app/(dashboard)/penjualan/actions.ts` — saveInvoiceAwb, refreshInvoiceTracking, getInvoiceTracking; InvoiceRow extended
- `src/app/(dashboard)/penjualan/_components/ResiDialog.tsx` — AWB input with tracking refresh + display
- `src/app/(dashboard)/penjualan/_components/InvoiceTable.test.ts` — fixture updated
- `src/app/(dashboard)/penjualan/awb-tracking.test.ts` — 19 real unit tests

## Validation Summary

| Gate | Result |
|---|---|
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `typecheck` | PASS |
| `eslint --quiet` | PASS |
| Focused AWB/tracking tests | 19/19 PASS |
| Full unit suite | 880 pass / 0 fail / 315 skipped |
| `next build --webpack` | PASS |
| `git diff --check` | PASS |
| Migration 004 local | PASS (5/5, status clean, diff empty) |

## Closure Blockers — RESOLVED

### 1. Fake Tests — RESOLVED

All 19 `expect(true).toBe(true)` placeholders replaced with real unit tests that exercise the actual server-action functions against mocked Prisma.

### 2. AWB Atomicity — RESOLVED

`saveInvoiceAwb` wraps InvoiceTracking upsert + Invoice.trackingNumber update in `$transaction`. Both succeed or both roll back. Audit fires after commit.

### 3. ResiDialog Error Flow — RESOLVED

`saveInvoiceAwb` result is checked. Error → toast + early return. `updateInvoiceShipping` never called on AWB failure.

## Next Session Sequence

| Session | Task |
|---|---|
| #1 | ~~Review Batch 4 final WIP, commit, push~~ — THIS SESSION |
| #2 | Authorize Batch 5 (Storefront UX) |

## DO NOT

- Start Batch 5 until explicitly authorized
- Touch `information_architecture_audit.md` (untracked, untouched)
