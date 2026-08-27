---
name: ros-inventory-ledger
description: Inventory ledger rules for roastd.id — immutable source of truth, cache sync, reversal-only corrections, WAC valuation, audit/repair commands. Triggers on stock, ledger, purchases, adjustments, storefront reservations.
license: Internal
---

# Inventory Ledger — roastd.id

Canonical sources: `README.md` (Database Rules, Inventory Ledger), `src/lib/supply-*.ts`, `scripts/audit-stock.mts`, `scripts/audit-data-integrity.mts`, `scripts/repair-*.mts`

## Hard Rules (non-negotiable)

1. **`InventoryLedger` = source of truth** — append-only, immutable mutations
2. **Product & packaging stock columns = transactional caches** — updated **atomically in same DB transaction** as ledger entry
3. **Business codes unique per tenant**
4. **Semua dashboard DB access wajib `requireTenantPrisma()`**
5. **Cross-tenant FK ditolak** oleh Prisma tenant extension
6. **Koreksi hanya via reversal entries atau VOID workflows** — **tidak pernah edit ledger entry**
7. **Jangan edit migration applied** — buat migration baru untuk setiap schema change

## Ledger Mechanics

- Setiap mutasi = `IN` / `OUT` dengan operator attribution
- Valuasi **WAC (Weighted Average Cost)** direkonstruksi dari ledger immutable as-of timestamp laporan
- **ATP = OnHand − Allocated + Inbound** (within horizon)
- Reservation: storefront order reserve stok → cron `payment-submissions` hourly return reserved stock jika unpaid
- Idempotency keys untuk webhook/retries (Artisan, Midtrans)
- Purchases: cash, partial, credit terms → supplier payments immutable dengan VOID correction, payable aging, Balance Sheet integration

## Verification Commands (wajib jalankan sebelum release)

```bash
pnpm audit:stock      # cek drift product/packaging vs ledger
pnpm audit:integrity  # cek data integrity violations
pnpm audit:tenant-isolation  # cek cross-tenant read/update rejection
```

## Repair Commands (dry-run default, review sebelum `--apply`)

```bash
pnpm repair:tenant-relations
pnpm repair:hpp-cache
pnpm repair:lot-ledger
pnpm repair:journals
# lalu re-run audit:stock + audit:integrity
```

## Storefront Reservation Semantics

- Customer order → stock reserved (ledger entry type RESERVE/OUT)
- Payment verified → confirmed OUT + cash journal
- Cron hourly: unpaid order expired → invoice void → reversal journal → reserved stock returned (ledger entry IN)

---

**Ketika menyentuh stok/inventory:** validasi di `requireTenantPrisma()`; ledger entry dulu baru cache update same transaction; koreksi = reversal only; jalankan audit sebelum commit.