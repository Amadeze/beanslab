# Improvement Roadmap 2026 — roastd.id

> Roadmap prioritas berdasarkan riset kompetitif (COMPETITIVE_LANDSCAPE_2026.md) + audit nyata tenant produksi (kimaise.roastd.id, nalweng.roastd.id). Setiap item punya justifikasi sumber + estimasi effort relatif.

---

## P0 — Critical (Commerce Integrity & Visual Foundation)

### P0-A: Polish Komponen Inti Storefront + Rebuild 6 Keluarga Tema
**Justifikasi**: kimaise pakai 13 section (marquee, bento, radar, sticky narrative) tapi hasil visual tetap jauh di bawah VOTRRO/Tanamera → plafon di **kualitas internal komponen**, bukan jumlah tema.
**Sumber**: COMPETITIVE_LANDSCAPE §4 Gap "Visual polish komponen inti", §2 VOTRRO design tokens, §3 9-section PDP anatomy
**Scope**:
- Redesign internal komponen shared: `ProductCard`, `HeaderNavSection`, `HeroBannerSection`, `FooterNavSection`, `CatalogGridSection`, `KineticMarqueeSection`, `BentoShowcaseSection`, `FAQSection`, `InteractiveFlavorSection`, `WholesaleRadarSection`
- Standar VOTRRO: tipografi disiplin (Inter/JetBrains Mono / font per tema), spacing konsisten (8px grid), handling foto buruk tetap elegan (aspect ratio lock, placeholder blur), radius per tema
- **Rebuild 6 keluarga** via 6 preset baru purpose-built (tidak modifikasi legacy):
  1. **Roast Lab** — monokrom putih/ink `#111`, accent tembaga `#B4531F`, **radius 0**, Roboto Mono data labels, header ticker, grid texture → VOTRRO
  2. **Award Storyteller** — kertas krem, serif display (Playfair/Fraunces), awards strip, brand timeline → Tanamera
  3. **Field Guide** — hijau botani earthy, aksen tulisan tangan (Caveat?), kartu origin lapangan, gallery-forward → Dokumenter alam
  4. **Industrial Poster** — border tebal hitam, tipografi raksasa, marquee kinetis, kontras keras → Swiss industrial
  5. **Dark Luxury Gallery** — nyaris hitam, aksen champagne/gold, serif italic, whitespace luas, fade lambat → Galeri mewah
  6. **Warm Neighborhood** — radius besar (20+), Fredoka/Nunito, pastel hangat, papan komunitas, bento ramah → Coffee club
- **3 seksi baru**: `awards_strip` (stat badges), `brand_timeline` (narrative_step reuse), `sustainability` (stat + rich_text komposisi)
- **Starter Content Pack** per keluarga: konten contoh Indonesia realistis (headline, about, FAQ, copy seksi) langsung terisi saat pilih tema, ditandai "contoh — silakan edit"
**Files touch**: `src/features/portal-theme/defaults/theme-presets.ts` (6 preset baru), `curated-families.ts` (recipe struktur), 3 komponen seksi baru + registry + `SECTION_COMPONENTS` + union types, `ThemePresetSelector` marks, update test (`batch6-customizer.test.ts`, `theme-blueprints.test.ts`)
**Effort**: Besar (multi-file, cross-cutting) — **estimasi 3–5 hari terfokus**

### P0-B: Commerce Integrity Guard (Lembut)
**Justifikasi**: kimaise tanpa payment method + produk stok 0, nalweng 0 produk — toko tayang publik tapi **tidak bisa transaksi** tanpa peringatan apa pun.
**Sumber**: COMPETITIVE_LANDSCAPE §4 "Commerce integrity guard", audit nyata kimaise/nalweng, user decision "Lembut: skor + checklist"
**Scope**:
- **Skor kesiapan toko** di dashboard (Settings → Portal): logo ✓, hero image ✓, ≥3 produk ✓, deskripsi+foto produk ✓, metode bayar ✓, kontak (WA/email/IG) ✓
- **Progress ring / progress bar** visual di halaman portal customizer
- **Banner peringatan** di storefront preview mode: "Toko belum siap transaksi: metode pembayaran belum disetel" dll.
- **Tidak blocker keras** — toko tetap tayang publik, tapi pemilik tahu pasti apa yang kurang
- Validasi server-side saat publish: return skor + missing items
**Files touch**: `src/lib/storefront-catalog.ts` (scoring logic), `src/app/(dashboard)/settings/portal-customizer/page.tsx` (UI skor), `src/features/portal-theme/components/PortalThemeRenderer.tsx` (preview banner), `src/app/tenant/[subdomain]/page.tsx` (optional warning banner)
**Effort**: Sedang — **estimasi 1–2 hari**

### P0-C: Starter Content Pack per Keluarga Tema
**Justifikasi**: kimaise isi joke ("JAMBOTTTT", "enak anjing") karena default template membosankan/instruksional; Tanamera/VOTRRO punya copy realistis.
**Sumber**: Audit nyata kimaise (heroText "Kopi Jem", aboutText "JAMBOTTTT POKOK E CANCOK", testimonial "enak anjing"), COMPETITIVE_LANDSCAPE §2 VOTRRO/Tanamera content patterns
**Scope**: Setiap 6 keluarga tema dapat `defaultContent` object dengan:
- Hero headline options (3 varian per tema)
- About paragraph template (200–300 kata, editable)
- FAQ set (5–7 Q&A realistis per domain roastery)
- Section copy defaults (hero subtitle, catalog subtitle, footer tagline)
- Ditandai dengan flag `isStarterContent: true` → UI bisa tampilkan "Konten contoh — klik untuk edit"
**Files touch**: `src/features/portal-theme/defaults/curated-families.ts` (extend `CuratedThemeFamily` dengan `starterContent`), `ThemePresetSelector` apply mode "style-and-layout+content", `PortalThemeRenderer` inject starter content
**Effort**: Sedang — **estimasi 1–2 hari** (bersamaan P0-A)

---

## P1 — High Impact (Product Data & Conversion)

### P1: Data Produk Wajib + Roast Date Absolut
**Justifikasi**: kimaise 2 produk tapi deskripsi/foto/origin/roastLevel semua null; Godmode CRO: roast date #1 conversion driver; VOTRRO roast calendar proof.
**Sumber**: COMPETITIVE_LANDSCAPE §3 "Top Conversion Killers", §2 VOTRRO roast calendar, audit kimaise products null fields
**Scope**:
- **Form produk wajib-minimal** (server-side validation): foto (min 1), deskripsi (min 50 karakter), origin (dropdown dari master data), roastLevel (enum), netWeightGrams, price
- **Roast date absolut** di storefront: "Roast: 21 Agu 2026" (format `dd MMM yyyy` pakai tenant timezone) — di kartu produk, spec section tema portal, halaman status pesanan publik
- Source: latest completed roast batch per product/offering (query tenant-scoped, **tanpa migrasi DB** — pakai relasi existing `RoastingBatch` → `FinishedGoods` → `Product`)
- Spec block tambahan: origin, process, altitude, varietal (dari master data lot/roast batch)
**Files touch**: `src/lib/storefront-catalog.ts` (extend loader dengan `latestRoastDate`), `src/app/(dashboard)/produk/*` (validasi form), `src/features/portal-theme/components/sections/CatalogGridSection.tsx` (roast date badge), `ProductDetail` section (jika ada), `src/app/tenant/[subdomain]/order/[token]/page.tsx`
**Effort**: Sedang — **estimasi 2–3 hari**

---

## P2 — Usability (Dashboard Simplification)

### P2: Penyederhanaan Dashboard
**Justifikasi**: 67 halaman dashboard, 13 nav items, 13 settings sub-pages, 7-tab theme editor, ~6 EmptyState duplikat, tabel mobile masih bermasalah → beban kognitif tinggi untuk user baru.
**Sumber**: Audit nyata (HANDOFF, UX_AUDIT, PRODUCT_AUDIT), COMPETITIVE_LANDSCAPE §4
**Scope**:
1. **Konsolidasi EmptyState** — ~6 duplikat (`EmptyState`, `InventoryEmptyState`, per-module di penjualan/roasting/produksi/keuangan/master-data) → 1 shared `src/components/ui/empty-state.tsx` dengan props `variant: 'default'|'filtered'|'permission'|'empty-catalog'|'empty-lots'`
2. **Picker tema** — sembunyikan 16 preset legacy dari UI picker (hanya 6 curated families); render tetap kompatibel untuk tenant lama
3. **Progressive disclosure nav** — grup Kontrol (Kas & Piutang, Laporan, Akuntansi, Tanya AI) & Kelola (Pengaturan) collapsible default; OWNER sees all, OPERATOR/CASHIER sees relevant only
4. **Mobile card view** — konversi tabel → kartu di: **Penjualan list** (prioritas tinggi) + **Inventori list** (prioritas tinggi); pakai `src/components/ui/table.tsx` responsive pattern + card fallback
**Files touch**: `src/components/ui/empty-state.tsx` (new shared), `src/components/layout/Sidebar.tsx` (nav disclosure), `src/app/(dashboard)/penjualan/page.tsx`, `src/app/(dashboard)/inventory/page.tsx` (mobile cards), `src/features/portal-theme/components/ThemePresetSelector.tsx` (hide legacy presets)
**Effort**: Kecil-Sedang — **estimasi 2–3 hari**

---

## Deferred (P3+ — Dicatat Saja, Belum Dikerjakan)

| Item | Alasan Ditunda |
|---|---|
| Green usage projections / run-out forecasting | Cropster standard tapi butuh scheduling engine baru |
| Inventory alerts / reorder points | Butuh notification system + preference per tenant |
| Production scheduling queue + operator assignment | Butuh calendar UI + resource allocation logic |
| Green grading data (moisture, density, defects) | Butuh schema extension di Lot/PurchaseReceipt |
| Sample management workflow | Butuh new entity + approval flow |
| Certifications tracking (Organic, Fair Trade, EUDR) | Regulatory scope, butuh legal review |
| Wholesale self-serve portal (B2B customer login) | Butuh customer portal architecture terpisah |
| Marketplace integrations (Tokopedia/Shopee/GoFood API) | **Strategi DTC-first** — web tenant sendiri adalah channel utama |
| Label printing | Nice-to-have, butuh PDF template engine |

---

## Verification Gates Per Fase

| Fase | Gates Wajib |
|---|---|
| P0-A | `pnpm typecheck` + `pnpm lint --quiet` + `pnpm test` (theme tests) + visual review manual |
| P0-B | `pnpm typecheck` + `pnpm lint --quiet` + unit test scoring logic |
| P0-C | Include di P0-A test |
| P1 | `pnpm typecheck` + `pnpm lint --quiet` + `pnpm test` (storefront-catalog tests) |
| P2 | `pnpm typecheck` + `pnpm lint --quiet` + `pnpm test:e2e` (smoke dashboard mobile) |

**Hard constraints** (dari HANDOFF):
- ❌ No migration DB untuk P0/P1 (pakai relasi existing)
- ❌ No touch migrations 000–004
- ❌ No commit/push tanpa otorisasi eksplisit
- ✅ Jalankan `pnpm audit:stock` + `pnpm audit:integrity` sebelum dan sesudah perubahan stok/logika produk

---

## Dependensi & Urutan Eksekusi (Bebas/Paralel per User)

```
Fase 1 (Knowledge Layer) ──┬──→ P0-A (Theme rebuild + komponen polish + starter content)
                           ├──→ P0-B (Commerce integrity guard)
                           ├──→ P1  (Produk wajib + roast date)
                           └──→ P2  (Dashboard simplification)
```
*Semua fase after Fase 1 bisa paralel; P0-A paling besar, bisa dipecah sprint.*