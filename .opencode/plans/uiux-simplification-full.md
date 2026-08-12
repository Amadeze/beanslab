# UI/UX Simplification — FULL (S1+S2+S3): Flow + UI + UX bersamaan

Status: user memilih eksekusi sekaligus ("lebih enak ubah flow dan ui dan ux bersamaan"). KEPUTUSAN FINAL: stage rail 6 tahap (+Gudang) disetujui; urutan eksekusi A→B→C→D. Menunggu keluar dari plan mode. Commit per sub-fase (A/B/C/D) untuk revert aman, review di akhir.

Tidak ada perubahan schema. Target: ~100 elemen tab → ~60, navigasi tunggal dan berurutan, satu gerbang per tugas.

---

## FASE A — Navigasi & label (fast-win, tanpa struktur)

**A1. Sidebar 5 grup alur** (`Sidebar.tsx:89-225` `APP_NAV_SECTIONS`, 15→18 item):
- Hari ini: Ringkasan `/dashboard`
- Operasional: Pasokan `/inventory` → Gudang & Lokasi `/gudang` → Roasting `/roasting` → Profil Roast `/roasting/profiles` → Produksi `/produksi` → Penggilingan `/grinding` *(baru)* → Eksperimen `/eksperimen` *(baru)* → Cupping `/cupping` *(baru)*
- Komersial: Buka Kasir `/kasir` → Penjualan `/penjualan` → Kontrak OEM `/penjualan/kontrak` → Katalog `/katalog`
- Keuangan: Kas & Piutang `/keuangan` → Laporan `/laporan` → Akuntansi `/laporan/akuntansi` → Insight Assistant `/ai-insights`
- Kelola: Pengaturan `/settings`
- Update `canAccessNavigation` (Sidebar.tsx:227-249) +3 href; verifikasi role di grinding/eksperimen/cupping (hanya OWNER/MANAGER/OPERATOR → CASHIER tak melihat).

**A2. Rename pembeda**: WorkspaceNav.tsx:62-66 "Profil & log"→"Log Roast"; sidebar "Profil Roasting"→"Profil Roast"; sidebar "Keuangan"→"Kas & Piutang".

**A3. Breadcrumbs global**: baru `src/components/layout/Breadcrumbs.tsx` (client, `usePathname`, kamus label segmen) dirender di AppShell bawah top bar; hidden di `/dashboard` & `/kasir`.

**A4. Link silang**:
- fulfillment/page.tsx:60 "Terima stok" → `/inventory?view=receiving`
- BatchRecapClient: tambah "Lihat stok RB" → `/inventory?view=stock&cat=rb` (titik "Gudang RB")
- ReceivingList/QuickReceivePO: tiap baris "Atur lokasi lot" → `/inventory/lots/[lotCode]`
- PODetail: "Bayar ke supplier" → `/keuangan?tab=pembelian`
- CashierClient "Lihat invoice" → `/penjualan`; SalesClient "Buka Kasir" → `/kasir`

**A5. Keuangan `?tab=`** (`KeuanganClient.tsx:65`): inisialisasi tab dari `searchParams.tab` + sync URL; membuka entri cepat `/keuangan?tab=pengeluaran`.

**A6. Empty states linkable**: RoastingClient:167-176 → `/inventory`; ProductionClient:138-149 → `/inventory`+`/roasting`; QuickReceivePO:95-101 → `/inventory?view=po`.

**A7. Bersih**: hapus `OperatingHero.tsx` (dead); label konsisten "Nota" di kasir/penjualan.

## FASE B — De-fragmentasi halaman

**B1. Opname 2 sistem → 1 konsep 2 peran**: drawer inventory → "Penyesuaian Stok" (koreksi kecil); `/gudang/opname` → "Opname Lokasi" (penghitungan QR). Cross-link 2 arah di header kedua halaman.

**B2. "Terima Barang" 1 gerbang**: dialog "Barang Datang" (InventoryClient:208-278) beri opsi eksplisit "Beli langsung" / "Terima dari PO (n)" + link ke `?view=po`; relabel view `po`→"Pesanan & PO", `receiving`→"Penerimaan".

**B3. Pembayaran 2 peran jelas**: `/penjualan/pembayaran` = "Review Bukti Bayar" (proof storefront); `/keuangan` piutang = "Terima Pembayaran". Link silang + label beda di kedua halaman.

**B4. Stok per lokasi mudah**: `/gudang` (GudangClient.tsx) — tiap baris lokasi diberi link "Lihat stok" → `/gudang/scan?location=...`; rename tab scan → "Stok per Lokasi"; link `/gudang` ↔ `/inventory` di header keduanya.

**B5. Alur pasca-tindakan**: ProductionClient tambah "Lihat stok FG" → `/inventory?view=stock&cat=fg`; setelah PO receive utuh → toast+link "Atur lokasi lot".

**B6. Konsistensi invoice**: kasir & penjualan sama-sama `createInvoice` → seragamkan judul dialog ("Nota Baru" di kedua), biarkan alur tetap terpisah (dua mode kerja).

## FASE C — Konsolidasi laporan (20 pintu → 1 pusat, 0 yatim)

**C1. ReportLayout + super-tab "Akuntansi"** (`ReportLayout.tsx:45-71`):
- `SUPER_TABS` + `{ id: "akuntansi", label: "Akuntansi", icon: BookOpen, href: "/laporan/akuntansi" }`
- `AKUNTANSI_TABS` (7): Akuntansi `/laporan/akuntansi` (internal COA/Jurnal/Neraca Saldo tetap), Arus Kas `/laporan/akuntansi/arus-kas`, Buku Besar, Laba Ditahan, Neraca Lajur, Perubahan Ekuitas, Integrity.
- Ubah 6 halaman akuntansi (arus-kas, buku-besar, integrity, laba-ditahan, neraca-lajur, perubahan-ekuitas) dari PageHeader polos → render `ReportLayout` dengan `activeTab` baru (`akuntansi/...`) — 6 halaman yatim jadi hidup. Verifikasi struktur tiap page.tsx saat eksekusi (CoaListClient tak berubah).
- Sidebar "Akuntansi" tetap 1 item → `/laporan/akuntansi`.

**C2. Label anti-redundan**: "Analisa > Nilai Stok" → "Valuasi Stok" (beda dari "Inventory > Stok"); sisanya tetap. Route tak ada yang dihapus.

**C3. Laporan tetap satu pintu**: `/laporan` redirect → `/laporan/keuangan` (existing), "Kas & Piutang" vs "Laporan" sudah tidak tabrakan via A2.

## FASE D — Flow rail (keputusan user)

**D1. Stage rail 6 tahap** (`operating-stages.ts:31-44`): tambah `warehouse` (Gudang & Lokasi, `/gudang`, icon Warehouse, warna netral) antara Pasokan(01) dan Roasting(02); renumber: Pasokan→Gudang & Lokasi→Roasting→Produksi→Penjualan→Kas & Piutang.
- Update `titleStages` (operating-stages.ts:17-29): map "Gudang"/"Gudang & Lokasi" → warehouse.
- Cek counter "SYS 0{n}/05" (`PageHeader.tsx:68-72`) — kalau hardcode, jadi 06.
- DashboardShell pipeline 5 stage (DashboardShell.tsx:82-128) → sesuaikan jadi 6 dan blur sesuai urutan baru.
- Mobile rail (PageHeader:151-206) mengikuti otomatis (render dari array).

## Verifikasi (gate, tiap sub-fase)
1. `npx tsc --noEmit` 0 error.
2. `pnpm vitest run` (unit) — perhatikan e2e specs yang mengklaim label/tab: `product-information-architecture.spec.ts:78`, `core-operating-workspaces.spec.ts:90`, `ui-smoke.cjs`; update assertion bila label berubah.
3. Lint file berubah.
4. `RUN_INTEGRATION=true pnpm vitest run` (regresi DB tidak mungkin, tapi aman).
5. Spot-check via webapp-testing bila server lokal jalan: sidebar baru, breadcrumbs, `?tab=`, link silang, ReportLayout akuntansi.
6. Commit bertahap: `refactor(ui): flow-based navigation…` (A) → `refactor(ui): unify entry points and cross-links…` (B) → `refactor(ui): consolidate report center with accounting…` (C) → stage rail (D).

## Risiko & catatan
- C1 menyentuh 6 halaman laporan — risiko terbesar; urutkan C terakhir, verifikasi tiap page.tsx dulu.
- Label assertion e2e bisa patah → update test di commit yang sama.
- Tidak ada utang teknis baru: hanya UI server/client refactor, tanpa schema/migrasi.