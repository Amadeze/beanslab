# HANDOFF — Batch 8 B2B Storefront Essentials

Last updated: 2026-08-22

## Current State

| Field | Value |
|---|---|
| Implementation HEAD | `2fe5b7f` plus uncommitted Batch 8 worktree |
| Branch | `wip/non-kopi-commit3` |
| Local commits ahead of origin | 2 (`c0a1f78`, `2fe5b7f`) |
| Batch 6.5 status | **COMMITTED LOCALLY — NOT PUSHED** |
| Batch 7 status | **COMMITTED LOCALLY — NOT PUSHED** |
| Batch 8 status | **IMPLEMENTED — READY TO COMMIT** |

## Local Commits

- `c0a1f78 feat(storefront): curate themes and consolidate renderer`
- `2fe5b7f feat(storefront): improve seo performance and accessibility`

Neither commit has been pushed.

## Batch 8 Delivered

- Partner links are signed and tenant/customer-bound; a phone number alone never reveals contract pricing.
- Each request revalidates active tenant, wholesale customer, contract dates/status, and tenant ownership.
- Partner catalog supports tier prices, private finished-good SKUs, and contract quantity breaks.
- Cart pricing changes at the correct quantity threshold and stays isolated from the tenant's retail cart.
- Checkout reloads prices server-side and snapshots contract price/source into the existing Invoice/InvoiceItem lifecycle.
- CREDIT appears only when both the contract and tenant payment configuration allow it.
- Contract payment terms determine the B2B due date; B2B credit orders are not voided by retail storefront expiry.
- Customer PO/reference is stored on Invoice and visible in public order status and staff sales UI.
- Recent B2B orders can be loaded again using current catalog and contract prices.
- B2B URLs are private/noindex and never publish negotiated structured-data offers.
- Migration `000000000005_storefront_b2b_essentials` is additive; migrations 000–004 are untouched.

## Validation

| Gate | Result |
|---|---|
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `typecheck` | PASS |
| `eslint --quiet` | PASS |
| Focused B2B behavior tests | 51/51 PASS |
| Portal-theme + B2B + sales regression suite | 320/320 PASS |
| `next build --webpack` | PASS |

The existing environment does not provide a usable local database password. DB-backed checkout/catalog tests remain skipped, and migration 005 still needs fresh disposable-database deploy/status/diff acceptance before production deployment.

## Deferred

- Raw green-bean wholesale/direct sale requires a separate kg-based InvoiceItem, fulfillment, inventory-ledger, and accounting design.
- CoffeeOffering-specific contract prices require an OfferingVariant pricing relation.
- A separate hard-MOQ policy is not inferred from the existing price-break `minOrderQty`.
- Password/OTP customer accounts are not introduced; this batch uses signed partner links.

## Next

1. Review and commit Batch 8.
2. Push only with explicit authorization.
3. Run migration 005 disposable/production deployment acceptance when valid database credentials are available.
4. Start Final Product Coherence only after explicit authorization.

## DO NOT

- Touch `information_architecture_audit.md`.
- Modify migrations 000–004.
- Push without explicit authorization.
- Start Final Product Coherence implicitly.
