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
| Batch 4 | AWB / Tracking | ⏳ NOT STARTED |
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

## Migration State

Active local migration chain after Batch 3 WIP:

```
000000000000_baseline
000000000001_preserve_domain_invariants
000000000002_tenant_shipping_rajaongkir
000000000003_storefront_shipping_checkout
```

Local acceptance evidence (2026-08-21):

- Fresh `migrate deploy`: PASS, 4/4 applied
- `migrate status`: clean (up to date)
- `migrate diff --script`: empty (no difference)
- `migrate diff --exit-code`: 0

Do NOT imply migration 003 exists in production yet.

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

Migration 003 pending deployment until this commit reaches production.
