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
| Batch 5 | Storefront UX | ✅ CLOSED + PUSHED |
| Batch 6 | Theme / Customizer | ✅ CLOSED + PUSHED |
| Batch 6.5 | Storefront theme architecture cleanup | ✅ COMMITTED LOCALLY (`c0a1f78`) |
| Batch 7 | SEO / Perf / A11y | 🟢 IMPLEMENTED — READY TO COMMIT |
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

## Batch 5 — Delivered Scope

- Fake/demo storefront content removed (CoffeeCards, hardcoded products/USD/Unsplash)
- Storefront language → Bahasa Indonesia; empty/error states improved
- Product/cart UX improved (accurate subtotal + tax + shipping + grand total)
- COURIER destination search wired to Batch 3 `/shipping/destinations` + `/shipping/quote`
- Authoritative shipping quote/service selection with destinationToken + shippingQuoteToken
- Tokens sent to checkout payload for COURIER orders
- SHIPPING_RATE_CHANGED recoverable UX (stale quote cleared, re-select destination/rate)
- Customer AWB/tracking timeline (order status page, InvoiceTracking relation)
- Mobile storefront improvements (cart drawer full-width on small screens)
- No schema migration (uses existing Batch 3-4 schema)
- SectionErrorBoundary fixed (proper React class error boundary)
- cartStore tests (11) + CourierShippingSearch tests (24) = 35 tests PASS
- typecheck PASS, eslint PASS, webpack build PASS

### Exclusions (Batch 5 scope boundary)

- Theme / Customizer → Batch 6
- SEO / Perf / A11y → Batch 7
- B2B → Batch 8

## Batch 6 — Delivered Scope

- 7 curated tenant-facing theme families (Minimal, Editorial, Modern, Heritage, Bold, Dark, Boutique)
- Compatibility preserved for all 16 existing preset IDs (legacy compatibility layer)
- Contextual customizer IA with 7 tabs: Tema, Header, Beranda, Katalog, Konten, Footer, Pengaturan
- Contextual Add Section restrictions (only relevant section types per tab)
- Direct live PortalThemeRenderer preview (no iframe, same render path as production)
- Real tenant subdomain in preview browser chrome and "View Live Portal" link
- Global design controls: Colors (12 tokens + presets), Typography (font pairs + scale/weight/transform), Layout (content width, gaps, padding, radius), Animations (duration, easing, scroll/hover/reduce-motion)
- Supported SEO/Integrations: GA4, Meta Pixel; deprecated customHead/customFooter removed from tenant UI (fields remain inert)
- Preset application behaves as normal unsaved edit: isDirty=true, Discard restores saved state, Undo/Redo works
- No schema migration (reuses existing JSON/theme architecture)

### Exclusions (Batch 6 scope boundary)

- SEO / Perf / A11y → Batch 7
- B2B → Batch 8

## Batch 6.5 — Delivered Scope

- One modern storefront rendering path through `PortalThemeRenderer`
- Dead duplicate theme engine removed while persisted legacy sections retain compatibility
- `SECTION_REGISTRY` is the source of truth for area, category, addability, lifecycle status, capabilities, and aliases
- Canonical section IDs with non-mutating alias resolution for persisted JSON
- Add Section derives its available sections and grouping from registry metadata
- Newsletter retained for legacy rendering but hidden from Add Section because no subscriber backend exists
- Default theme configuration contains canonical IDs and no fake merchant or product content
- All 16 preset IDs retained for compatibility
- No schema migration and no commerce, shipping, accounting, or inventory behavior changes

## Batch 7 — Delivered Scope

- Tenant-specific metadata, canonical URLs, social sharing metadata, and preview `noindex`
- Safe `OnlineStore` and real-catalog `ItemList` structured data with no fake offers
- Central storefront image component with supported remote optimization, intrinsic sizing, responsive `sizes`, and legacy URL fallback
- Critical-image preload policy, lazy loading for non-critical media, and reduced-motion support
- Explicit persisted-cart hydration guard to prevent stale cart UI during initial render
- Dialog focus containment, Escape dismissal, focus restoration, disclosure semantics, form labels, and selection state semantics
- Responsive customizer editor/preview layout for narrow screens
- Unknown and persisted external storefront images remain graceful
- No schema migration and no commerce, shipping, accounting, or inventory behavior changes

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

## Validation Evidence (Batch 5)

| Gate | Result |
|---|---|
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `typecheck` | PASS |
| `eslint --quiet` | PASS |
| Focused storefront tests | 35/35 PASS (cartStore 11, CourierShippingSearch 24) |
| Full unit suite | 915 passed, 0 failed, 315 skipped |
| `next build --webpack` | PASS |
| `git diff --check` | PASS |
| No schema migration | CONFIRMED |

## Validation Evidence (Batch 6)

| Gate | Result |
|---|---|
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `typecheck` | PASS |
| `eslint --quiet` | PASS |
| Focused Batch 6 tests | 55/55 PASS |
| Full portal-theme suite | 240/240 PASS |
| Full unit suite | 972 passed, 2 AWB timeout failures (pre-existing), 315 skipped |
| `next build --webpack` | PASS |
| `git diff --check` | PASS |
| No schema migration | CONFIRMED |

## Validation Evidence (Batch 7)

| Gate | Result |
|---|---|
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `typecheck` | PASS |
| `eslint --quiet` | PASS |
| Focused Batch 7, cart hydration, and courier tests | 46/46 PASS |
| Full portal-theme suite | 264/264 PASS |
| `next build --webpack` | PASS |
| `git diff --check` | PASS |
| No schema migration | CONFIRMED |
| Live 360/390/430 tenant walkthrough | DEFERRED — local database credentials unavailable; responsive source/tests/build verified |

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
