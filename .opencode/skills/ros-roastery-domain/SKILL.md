---
name: ros-roastery-domain
description: Coffee roastery domain model as implemented in roastd.id — lot→roast→packaging→sales lifecycle, yields, HPP, cupping, Artisan telemetry, freshness windows, KPI benchmarks, VOTRRO/Tanamera/Nana reference patterns. Triggers on roasting, lots, cupping, production, HPP, Artisan work.
license: Internal
---

# Coffee Roastery Domain — roastd.id

Canonical sources: `README.md` (Roastery Workflows), `src/lib/studio-roasting-*`, `src/lib/artisan/*`, `src/lib/supply-*`, `src/lib/cupping*`, `src/lib/cupping*`, VOTRRO.com, Tanamera Coffee, Nana Coffee Roasters

## Material Lifecycle (domain identity colors)

**Pasokan (Verdigris) → Roasting (Copper) → Produksi & Packing (Brass) → Penjualan (Plum) → Kas & Piutang (Moss)**

## Lot Discipline (Green Coffee)

- **Jangan pernah mencampur lot** — setiap delivery punya crop year, supplier, kualitas, sisa berat sendiri
- Field wajib: origin, farm, variety, processing, crop year, tanggal tiba, berat diterima, moisture, density, lokasi gudang, target use-by date
- **Green coffee = agricultural inventory dengan jam terbang**: flavor window 6–18 bulan dari crop harvest (specialty)
- **FIFO/FEFO**: lot lebih tua dipakai dulu; pengecualian jika lot baru lebih time-sensitive
- Minimum stock level harus hitung lead time 4–12 minggu shipping dari origin

## Roast Batch (Roasting)

- Input: green bean lot(s) + charge weight
- Output: roasted weight → **yield/shrinkage** = (output/input) × 100; typical shrinkage 12–20%
- **HPP** = (green cost + roasting cost + packaging) / roasted output weight
- Artisan telemetry webhook (`/api/webhooks/artisan`) → simpan di webhook inbox
- **Aturan penting**: jika >1 batch pending, payload wajib `parent_batch_id` (legacy `?token=` masih didukung)
- Cupping score unik per sesi/kategori, constrained di DB layer

## Produksi & Packing (Brass)

- Roasted beans → finished goods (retail bags, wholesale units, drip bags, capsules)
- Packaging sebagai **critical path consumable** — stockout packaging hentikan produksi walau green & roasting ready
- B2B kontrak: tenant/customer scoped, bisa MOQ tier, per-kg price, per-unit price

## Penjualan & Kas (Plum + Moss)

- Sales, payments, stock mutations, contract changes → tenant-scoped audit records
- Storefront: grind options (8 size), QRIS/transfer, proof upload → verifikasi OWNER/MANAGER/CASHIER
- Inventory valuation = **WAC reconstruksi dari ledger immutable** as-of timestamp

## KPI Industri (benchmark nyata dari riset Cropster/Fluxventory/Coffeepedia)

| Metric | Target |
|---|---|
| Green coffee turnover | 3–4×/tahun |
| FEFO compliance (≥6 bulan dari terima) | ≥90% |
| Inventory accuracy (physical vs system) | ≥98% green, ≥95% packaging |
| Days roasted coffee on hand | 7–14 hari max |
| Packaging out-of-stock rate | <2% |
| Roast yield tracking | per batch, auto-post ke GL |

## Referensi Nyata (untuk kalibrasi visual/UX)

- **VOTRRO (Pluit)**: "Roast calendar terbuka" — setiap batch tanggal & profil transparan; tools edukatif (brew ratio, COGS calculator, 90+ resep); omnichannel (web/Tokopedia/Shopee/GoFood/Grab); loyalty + referral
- **Tanamera (51 award)**: Storytelling award/farmer, wholesale services (bar setup, visual merchandising), drip bag, Shopee Mall, brand history timeline
- **Nana Coffee Roasters (Thailand, ada Pluit juga)**: Navigasi **berdasar cara seduh** — "Coffee for Filter / Best for Milk / Drip Bag / Capsule / Cold Brew" — bukan berdasarkan origin
- **Anomali (2007)**: Regional Indonesian beans per region

---

**Ketika mengerjakan domain roastery:** hormati lot discipline; hitung yield/HPP otomatis dari batch; expose freshness windows ke storefront; pakai KPI di atas sebagai acceptance criteria fitur.