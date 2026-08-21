# ROASTD.ID — Phase 2H Roadmap

Branch: `wip/non-kopi-commit3`

## Phase Status

| Phase | Status |
|---|---|
| 2F Finance | ✅ CLOSED |
| 2G Reporting & Analytics | ✅ CLOSED |
| 2H Storefront / B2B Portal | 🟡 IN PROGRESS |

## 2H Storefront / B2B Portal — Batch Status

| Batch | Scope | Status |
|---|---|---|
| Audit / Standards | Baseline audit, standards | ✅ CLOSED |
| Batch 1 | Commerce correctness | ✅ CLOSED + PUSHED |
| Migration History Recovery | Schema/migration recovery | ✅ CLOSED + PUSHED |
| Batch 2 | RajaOngkir foundation | ✅ CLOSED + PUSHED |
| Batch 3 | Customer shipping | ✅ CLOSED + PUSHED |
| Batch 4 | AWB / Tracking | ✅ CLOSED + PUSHED |
| Batch 5 | Storefront UX | ⏳ NOT STARTED |
| Batch 6 | Theme / Customizer | ⏳ NOT STARTED |
| Batch 7 | SEO / Perf / A11y | ⏳ NOT STARTED |
| Batch 8 | B2B | ⏳ NOT STARTED |

## Batch 3 — Delivered Scope

- Customer-facing RajaOngkir destination search
- Server-authoritative destination token (tamper-evident, tenant-bound)
- Canonical shipment-weight calculation (tenant-scoped variant query)
- Deterministic cart fingerprint (canonical line normalization)
- Shipping quote endpoint (server-authoritative weight, fingerprint, quote token)
- Authenticated short-lived quote token (`sqtv1`, AES-256-GCM, 15-min TTL)
- Tenant courier whitelist enforcement
- Authoritative final RajaOngkir revalidation before durable checkout state
- `SHIPPING_RATE_CHANGED` conflict/reconfirmation semantics
- Provider failure creates no partial Invoice/reservation/payment/Midtrans
- Immutable Invoice shipping transaction snapshot (no `shippingQuoteToken`)
- Authoritative `shippingCost` in Invoice total
- Midtrans shipping represented exactly once
- Existing checkout idempotency retained
- Tenant isolation retained
- Anonymous CREDIT rejection retained
- Migration 003 added (9 columns, not 10)

### Exclusions (Batch 3 scope boundary)

- No AWB workflow
- No tracking UI
- No courier webhook
- No automatic DELIVERED
- No storefront redesign
- No Theme Customizer changes

## Batch 4 — Delivered Scope

- Staff AWB save/replacement via ResiDialog
- Canonical server-side courier derivation (never trusts client)
- Atomic InvoiceTracking + Invoice.trackingNumber write ($transaction)
- RajaOngkir tracking refresh via trackWaybillDetailed
- Normalized provider status/event history (normalizeTrackingResponse)
- Staff tracking timeline UI (ResiDialog)
- Provider DELIVERED remains informational only (no fulfillment/accounting/stock mutation)
- Tenant isolation on all AWB/tracking operations
- Migration 004 added (InvoiceTracking table, unique index, FK constraints)

### Exclusions (Batch 4 scope boundary)

- Customer-side full tracking timeline → Batch 5 Storefront UX
- Carrier external tracking URL → future if useful

## Migration State

Active local migration chain after Batch 4:

```
000000000000_baseline
000000000001_preserve_domain_invariants
000000000002_tenant_shipping_rajaongkir
000000000003_storefront_shipping_checkout
000000000004_storefront_awb_tracking
```

Local acceptance evidence (2026-08-21):

- Fresh `migrate deploy`: PASS, 5/5 applied
- `migrate status`: clean (up to date)
- `migrate diff --script`: empty (no difference)
- `migrate diff --exit-code`: 0

Do NOT imply migrations 003-004 exist in production yet.

## Validation Evidence (Batch 3)

| Gate | Result |
|---|---|
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `typecheck` | PASS |
| `eslint --quiet` | PASS |
| Full unit suite | 849 passed, 0 failed, 36 skipped |
| `next build --webpack` | PASS |
| `git diff --check` | PASS (CRLF warning only, non-blocking) |
| Migration 003 local acceptance | PASS |
| Integration suite | 34/39 files pass, 8 pre-existing finance failures (confirmed against d23482d), 0 attributed to Batch 3 |

**Note:** 8 integration failures are confirmed pre-existing regression debt (finance/purchase-void). They also fail on clean pre-Batch-3 checkpoint d23482d. Tracked separately, do not block Batch 3.

## Validation Evidence (Batch 4)

| Gate | Result |
|---|---|
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `typecheck` | PASS |
| `eslint --quiet` | PASS |
| Focused AWB/tracking tests | 19/19 PASS |
| Full unit suite | 880 passed, 0 failed, 315 skipped |
| `next build --webpack` | PASS |
| `git diff --check` | PASS |
| Migration 004 local acceptance | PASS (5/5, status clean, diff empty) |

## Closure Blockers (Batch 3) — RESOLVED

**A. Pre-existing Integration Failure Proof** — RESOLVED

8 finance/purchase-void tests confirmed pre-existing against clean checkpoint d23482d. Do not block Batch 3. Tracked as separate regression debt.

**B. Production Prisma Baseline Adoption** — RESOLVED

Production baseline recovery complete:
- 000 baseline resolved as applied
- 001 invariants deployed
- 002 RajaOngkir foundation deployed
- Production schema matches d23482d exactly (EMPTY diff)
- Invariant preflight: ALL PASS

Migration 003-004 pending deployment until this commit reaches production.
