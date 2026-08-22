# Progressive Redesign Plan

## Phase 0 — Baseline

- Build: lulus.
- TypeScript: lulus melalui production build; command mandiri diverifikasi ulang pada final gate.
- Lint/test: baseline menemukan tiga masalah terisolasi dan sudah diperbaiki.

## Phase 1 — Audit

Selesai: product map, feature inventory, route map, database map, workflow map, UX risk, security review.

## Phase 2 — Foundations

Dalam transformasi ini:

- Brand dan metadata roastd.id.
- Art direction karbon/parchment/ember.
- Navigation IA.
- Copy dan landing berbasis fitur aktual.
- Accessibility state dan permission guard.

Berikutnya:

- Konsolidasikan CSS variables lama menjadi semantic token tunggal.
- Kurangi variasi glass-card dan hardcoded slate/zinc.
- Tambahkan reusable status badge, filter bar, dan mobile data list.

## Phase 3 — Shell

Shell sudah responsive. Dashboard command center telah dibangun dengan:

- Machine-console shell untuk seluruh modul.
- Command rail gelap dengan telemetry penjualan, yield, dan piutang yang bersumber dari data aktual.
- Quick action mobile selalu terlihat di luar area scroll: Terima, Roast, dan Kasir.
- Kasir menjadi action utama yang menonjol di mobile dock.
- System spine gelap dengan IA berbasis aliran kerja.
- Inset instrument panel sebagai area kerja utama.
- Mobile workflow dock dan full navigation drawer.
- Roastery Flow Topology lima tahap.
- Decision queue berbasis daily brief, stok, dan piutang.
- Revenue field tujuh hari yang selalu terlihat.
- Metric plates untuk revenue, yield, margin, dan kopi terjual.
- Quick commands untuk empat pekerjaan utama.
- Analisis detail terbuka secara default.

Pekerjaan lanjutan: command search berbasis entitas aktual, role-aware quick actions, dan active group context.

## Phase 4–6 — Modules

Migrasi struktur isi core operations telah dimulai:

1. Bahan & Stok: prioritas stok kosong/reorder, nilai stok, PO aktif, dan mutasi harian.
2. Roasting: kesiapan lot/mesin, input-output, dan loss sebagai sinyal proses.
3. Produksi & Packing: readiness roasted bean + kemasan dan output SKU.
4. Penjualan & Pesanan: nilai penjualan, nota tempo, pembayaran, dan biaya sample.
5. Kas & Piutang: aging piutang dan prioritas konversi penjualan menjadi kas.

Dashboard telah diganti dari visual topology menjadi Operations Workbench yang task-first dan exception-first. Hero internal serta Operating Line per halaman dihapus karena menambah tinggi dan menduplikasi navigasi. Kelima workspace memakai compact header, ringkasan metrik, sub-navigation, dan data surface. Business actions, server action, route, dan data contract dipertahankan.

Berikutnya: reports, team, billing, settings, audit, serta pendalaman form/table per workflow.

## Information architecture consolidation

- Sidebar mengikuti lima konteks: Hari ini, Operasional, Komersial, Kontrol, dan Kelola.
- Pasokan menyatukan posisi stok, pembelian, penerimaan, mutasi, dan supplier.
- Roastery menyatukan batch roasting, profil/log Artisan, serta produksi/packing tanpa menggabungkan mutation bisnisnya.
- Penjualan menyatukan invoice/pesanan, Kasir, sample, dan pelanggan.
- `Master Data` dihapus sebagai konsep user-facing. Produk/kemasan menjadi Katalog; anggota tim dan audit masuk Pengaturan.
- Mesin, koneksi Artisan, profil/portal, team, audit, serta billing dikelompokkan dalam hub Pengaturan.
- Route lama memakai redirect untuk menjaga compatibility.

Quality gate per modul: workflow, permission, loading, empty/error, mobile, keyboard, validation, formatting, destructive confirmation, test.

## Phase 7–8

Landing selesai pada scope ini. Auth polish dan storefront theme consistency dilakukan progresif. Final gate menjalankan lint, typecheck, unit, build, e2e smoke/mobile, dan manual visual QA.
