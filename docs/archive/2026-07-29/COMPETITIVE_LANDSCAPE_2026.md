# Competitive Landscape 2026 — roastd.id Context

> Riset pasar roastery SaaS & roastery nyata Indonesia untuk grounding keputusan produk roastd.id. Semua data dari sumber publik terverifikasi (URL tercantum). Terakhir update: 2026-08-24.

---

## 1. Global SaaS Competitors (Coffee Roastery Software)

| Platform | Harga (entry) | Kekuatan Inti | Keterbatasan | Sumber |
|---|---|---|---|---|
| **Cropster** | €95/bln (CORE) → €275 (SCALE) → €999 (ADVANCED) + volume-based | Roasting Intelligence (auto stock deduct), green grading (moisture/density/screen size/defects), cupping SCA digital, proyeksi run-out green bean, alert reorder, lot swapping, warehouse transfer, sertifikasi (Organic/FairTrade/EUDR), audit reporting, Roast AI (71% pakai), API add-on €100, Cafe espresso telemetry €39/mesin | Mahal untuk small roastery; EUDR compliance tooling hanya tier atas; volume-based pricing tidak transparan | cropster.com, smb.toolsinfo.com |
| **Artisan + Artisan Plus** | Gratis (Artisan) + ~€499/thn (Plus) | Logger kurva live terbaik (open-source), hardware support luas, komunitas aktif | Lokal only (no cloud sync), Plus untuk inventory forecasting saja, no business features (POS, wholesale, finance) | artisan-scope.org |
| **RoastLog** | $129/bln | Cloud roast history + inventory dasar + laporan | Kurang depth di green grading, QC, wholesale | roastlog.com |
| **Firescope** | Gratis <10 roast/bln; ~$20/bln | Budget-friendly, UI mudah, cloud, free tier murah | Integrasi hardware/software terbatas, fitur wholesale/finance minimal | firescope.io |
| **RoasterTools** | Quote custom | Wholesale-first: task auto-planning, demand calculator, wholesale ordering, invoice | Tidak coffee-native di roast profiling/QC | roastertools.com |
| **First Crack** | Web gratis + Bridge macOS (beta) | Analitik RoR/DTR/fase/weight-loss, cupping SCA, import `.alog` langsung, komunitas sharing | Bridge macOS only, belum Windows/Linux; baru | firstcrack.app |
| **Rostoc / RoastWerk / Stocksmith** | Murah/gratis | Small roastery: lot→plan→batch traceability, import Artisan | Kurang wholesale/finance/pos | rostoc.co |

### Pricing Benchmark (Cropster 2026)
- CORE: €95/bln — consistent roast quality + green inventory control
- SCALE: €275/bln — growing ops, efficiency across planning/roasting/fulfillment
- ADVANCED: €999/bln — complex ops, ultimate productivity
- Add-ons: API €100, Sample Mgmt €199, Cafe €39/mesin, Resource Planning €500, Green Contracts €500
- **10% discount** annual plans

---

## 2. Real-World Indonesian Roastery Benchmarks (Consumer-Facing)

*Ini bukan kompetitor SaaS — ini **roastery nyata** yang menjalankan operasi yg roastd.id bantu. Gunakan sebagai "definition of done" untuk storefront tenant.*

### VOTRRO Coffee Roastery (Pluit, Jakarta Utara)
- **Stack**: React SPA + Supabase + Radix UI + Cloudflare (mirip roastd.id!)
- **Diferensiator**: "Roast calendar terbuka" — `/tools/roast-calendar` setiap batch tanggal & profil transparan
- **Katalog**: ~40 produk (Indonesia single origin Gayo Wine, Toraja Kurra, Lintong, Flores, Mandheling + internasional Ethiopia, Honduras, Colombia, Brazil + commercial lines + decaf)
- **Multi-kategori**: teh (black/vanilla/jasmine), peralatan (Minos dripper), suku cadang (SSP burrs 58–98mm), gula aren
- **Omnichannel nyata**: web shop + Tokopedia + Shopee + GoFood + GrabFood + café fisik (Pluit)
- **Tools edukatif**: brew-ratio, blend-lab, **COGS calculator**, 90+ resep (es kopi susu variants, vietnam drip, kopi tubruk), journal SEO (resting window, HPP guide, processing education)
- **Loyalty + referral program**
- **Design tokens (dari CSS produksi)**: Monokrom putih/ink `#111`, accent `#B4531F` (hampir identik Copper roastd.id `#B65331`), radius **0px**, Roboto + Roboto Mono, shadow flat
- URL: `votrro.com`, `votrro.com/tools/roast-calendar`, `votrro.com/shop`, `votrro.com/wholesale`, `votrro.com/tools/recipes`, `votrro.com/journal/*`

### Tanamera Coffee (Jakarta/Bali/Singapore — 51 international awards)
- **Positioning**: Award-winning Indonesian specialty, farmer story + sustainability
- **Wholesale division lengkap**: bar setup, visual merchandising, storytelling materials, curated activation programs (tanamera.cloud/wholesales)
- **Produk**: Coffee beans, drip bag, capsules, cold brew RTD, merchandise
- **Marketplace**: Shopee Mall official store, shop.tanameracoffee.co.id (Shopify), Singapore outlets
- **Content**: Brand history timeline (2013–2025), sustainability page, farmer education program
- **Design**: Warm editorial, award badges strip, serif display, storytelling hero
- URL: `tanameracoffee.co.id`, `tanameracoffee.com.sg`, `shop.tanameracoffee.co.id`

### Nana Coffee Roasters (Thailand, ada outlet Pluit Jakarta)
- **Navigasi berbasis cara seduh** (BREW-METHOD-FIRST IA):
  - "Coffee for Filter" / "Best for Milk" / "Drip Bag" / "Capsule Coffee" / "Cold Brew"
  - Bukan berdasarkan origin — ini **conversion pattern** yg terbukti
- **Katalog lengkap**: single origin (Panama Geisha, Ethiopia, Kenya, Costa Rica), house blend, capsules (Nespresso compat), drip bag, cold brew RTD, accessories (V60 filters, nebula booster)
- **Free shipping threshold** Thailand
- URL: `nanacoffeeroasters.com`

### Anomali Coffee (2007)
- Regional Indonesian beans per region (Aceh, Bali, Flores, Java, Papua, Sulawesi, Sumatra)
- URL: `anomalicoffee.com`

---

## 3. Storefront Conversion Playbook 2026 (Godmode CRO + Brewed Sites)

### 9-Section Coffee PDP Anatomy (Converting)
1. **Hero freshness-led** — "Roasted within 48 hours of shipping"
2. **Trust strip** — roast-date guarantee + certifications (USDA Organic, Fair Trade, Rainforest Alliance, Q-grade)
3. **Outcome grid** — 4 morning-moment benefits
4. **60-word sourcing story** — farm name, altitude, processing method
5. **Taste-profile quiz** atau head-roaster story
6. **Spec block** — origin, altitude, varietal, process, roast, grind, weight
7. **Photo-required reviews** filterable by brew method
8. **3-tier offer** — one-time + bundle + skip-anytime subscribe
9. **Sticky CTA + grind selector** + native payments

### Top Conversion Killers (hindari)
- ❌ Menyembunyikan tanggal roast — *"Show me the roast date on the bag or I am not buying, period"*
- ❌ Skip grind selector
- ❌ Bury subscription cancellation

### Buyer Language 2026 (Reddit r/Coffee, Trustpilot)
- "Show me the roast date on the bag or I am not buying"
- "Bought a bag, it had no roast date anywhere, returned it same day"
- "Fruity notes sounded like marketing until I actually tasted the blueberry thing"
- "Got espresso grind instead of pour-over grind, ruined my weekend cups"

### Subscription Retention Drivers (Brewed Sites)
- Fleksibilitas: pause, skip, swap bags, change grind on demand → **churn -48% setelah redesign subscription portal**
- Roast-date shipping cut-offs critical
- LTV driven by subscribe-and-save behavior

---

## 4. roastd.id Position vs Market

### Sudah Setara / Lebih Unggul ✅
- **InventoryLedger immutable + WAC as-of timestamp** — pola ERP sungguhan, bukan cache sederhana
- Pembelian kredit/parsel + piutang aging + jurnal keuangan + neraca
- Kontrak B2B dengan MOQ tier
- Tenant storefront + Midtrans/QRIS + proof verification
- Cupping dengan constraint DB layer
- Integrasi Artisan native (webhook `.alog` + telemetry)
- Multi-tenant SaaS dengan RLS + tenant extension
- **Tidak satu pun kompetitor di atas punya sisi finansial selengkap ini**

### Gap Terhadap Pemimpin Pasar (Gap Prioritas)

| Gap | Sumber | Prioritas |
|---|---|---|
| **Roast date / freshness badge di storefront** | Godmode #1 killer, VOTRRO roast calendar, kimaise/nalweng kosong | **P0** |
| **Starter content pack per tema** (hindari placeholder "Nama roastery") | kimaise joke content, nalweng skeleton | **P0** |
| **Commerce integrity guard** (skor kesiapan toko) | kimaise tanpa payment method + stok 0, nalweng 0 produk | **P0** |
| **Visual polish komponen inti** (kartu produk, hero, header, bento, radar) | kimaise pakai 13 section tapi hasil mediocre | **P0** |
| Green usage projections / run-out forecasting | Cropster standard | P1 |
| Inventory level alerts / reorder points | Cropster, Fluxventory KPI | P1 |
| Production scheduling queue + operator assignment | Cropster RI, RoasterTools auto-planning | P1 |
| Green grading data (moisture, density, defects) | Cropster green grading | P1 |
| Sample management workflow (sample→approval→inventory) | Cropster Pro, Rostoc | P1 |
| Certifications tracking (Organic, Fair Trade, EUDR) | Cropster audit reporting | P2 |
| Wholesale self-serve portal (B2B customer login) | RoasterTools, Unleashed B2B store | P2 |
| Marketplace integrations (Tokopedia/Shopee/GoFood API) | VOTRRO, Tanamera omnichannel | **DITUNDA** — strategi DTC-first via web sendiri |
| Label printing (roast labels, SLIC, bag stickers) | Cropster, Rostoc | P2 |

---

## 5. Keputusan Produk Tercatat

1. **DTC-first, marketplace ditunda** — semua roastery lokal benchmark (VOTRRO, Tanamera) punya web sendiri yang kuat; roastd.id enable web tenant, bukan jadi aggregator marketplace
2. **6 keluarga tema radikal berbeda** (rebuild, bukan tambah) — VOTRRO bukti monokrom+tembaga+ticker work; Tanamera bukti editorial+story work; Nana bukti navigasi brew-method work
3. **3 seksi baru wajib**: `awards_strip`, `brand_timeline`, `sustainability` — untuk ketengahan ala Tanamera
4. **Commerce integrity lembut** — skor + checklist di dashboard, badge preview di storefront, **tidak blocker keras** (user approved)
5. **Roast date absolut saja** ("Roast: 21 Agu 2026") — tanpa interpretasi warna kesegaran (user choice)

---

## 6. Sumber URL Lengkap (untuk verifikasi ulang)

**Global SaaS**: cropster.com/products/roast/features/, firescope.io, roastlog.com, roastertools.com, firstcrack.app, rostoc.co, artisan-scope.org
**Lokal Roastery**: votrro.com (all pages via sitemap.xml), tanameracoffee.co.id, shop.tanameracoffee.co.id, nanacoffeeroasters.com, anomalicoffee.com
**Conversion Research**: trygodmode.com/blog/shopify-product-page-coffee, brewedsites.com, rocket.new/templates/roast-specialty-coffee-roaster-landing-page-template
**Industry KPI**: fluxventory.com/en/blog/coffee-roastery-inventory-management-guide, coffeepedia (vauldt.github.io), softengine.com/blog-green-coffee-inventory-management
**roastd.id Live Tenants**: kimaise.roastd.id (origin_field_notes theme, 13 sections), nalweng.roastd.id (modern_catalog default)