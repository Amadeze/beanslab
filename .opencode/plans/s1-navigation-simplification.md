# S1 — Penyederhanaan Navigasi & Label (fast-win)

Status: DISETUJUI user (S1 dulu; sidebar 5 grup alur). Belum dieksekusi — menunggu keluar dari plan mode. Stop & review setelah commit S1.

## Masalah yang diselesaikan (dari audit)
- 8 sistem navigasi paralel, label kembar, rute ganda, halaman yatim, link silang hilang, empty state tanpa link, deep-link salah tab.

## Perubahan

### 1. Sidebar → 5 grup alur (`src/components/layout/Sidebar.tsx:89-225`)
Ganti `APP_NAV_SECTIONS` (15 → 18 item, urutan = alur user):
- **Hari ini**: Ringkasan `/dashboard`
- **Operasional**: Pasokan `/inventory` → Gudang & Lokasi `/gudang` → Roasting `/roasting` → Profil Roast `/roasting/profiles` → Produksi `/produksi` → Penggilingan `/grinding` *(baru)* → Eksperimen `/eksperimen` *(baru)* → Cupping `/cupping` *(baru)*
- **Komersial**: Buka Kasir `/kasir` → Penjualan `/penjualan` → Kontrak OEM `/penjualan/kontrak` → Katalog `/katalog`
- **Keuangan**: Kas & Piutang `/keuangan` → Laporan `/laporan` → Akuntansi `/laporan/akuntansi` → Insight Assistant `/ai-insights`
- **Kelola**: Pengaturan `/settings`

Catatan: cek `canAccessNavigation` (Sidebar.tsx:227-249) — tambahkan `/grinding`, `/eksperimen`, `/cupping` ke gating; pastikan role OPERATOR/CASHIER yang benar (verifikasi aksi di halaman tsb: grinding/eksperimen/cupping pakai role apa — sesuaikan; kalau hanya OWNER/MANAGER/OPERATOR, CASHIER tidak melihat).

### 2. Rename label pembeda
- WorkspaceNav.tsx:62-66 "Profil & log" → **"Log Roast"** (library .alog; label & href tetap `/roasting?tab=profiles`).
- Sidebar "Profil Roasting" → **"Profil Roast"** (template CRUD, `/roasting/profiles`).
- Sidebar "Keuangan" → **"Kas & Piutang"** (`/keuangan`) — selesaikan tabrakan dengan Laporan Keuangan.

### 3. Breadcrumbs global (`src/components/layout/Breadcrumbs.tsx` baru + AppShell)
- Client component pakai `usePathname`; kamus label per segmen (inventory→Pasokan, lots→Lot, penjualan→Penjualan, laporan→Laporan, akuntansi, settings, gudang, roasting, batch, kontrak, pembayaran, fulfillment, pelanggan).
- Render di AppShell di bawah top bar, sembunyikan di `/dashboard` dan `/kasir` (halaman fokus). Tanpa wiring per halaman.
- Hindari render saat pathname di luar shell (guard).

### 4. Link silang (menutup lompatan halaman)
- `penjualan/fulfillment/page.tsx:60` "Terima stok" → `/inventory?view=receiving` (bukan `/inventory`).
- `BatchRecapClient.tsx` (rekap batch) — tambah link "Lihat stok RB" → `/inventory?view=stock&cat=rb` (titik "Gudang RB" di alur user).
- `ReceivingList.tsx`/`QuickReceivePO.tsx` — tiap baris terima: link "Atur lokasi lot" → `/inventory/lots/[lotCode]` (kirim kode lot; kalau tidak ada field di row, tambahkan query untuk detail).
- `PODetail`/`PurchasePaymentSection` — link "Bayar ke supplier" → `/keuangan?tab=pembelian`.
- Kasir ↔ Penjualan: dari `CashierClient` tambah link "Lihat semua invoice" → `/penjualan`; dari `SalesClient` link "Buka Kasir" → `/kasir`.

### 5. Dukungan `?tab=` di Keuangan (prasyarat link #4)
`KeuanganClient.tsx` — tab saat ini internal state (`useState<Tab>("piutang")`, line 65). Ubah: inisialisasi dari `searchParams.tab` (validasi ke set tab), dan saat ganti tab update URL (shallow replace). Ini juga membuka entri cepat "Pengeluaran" → `/keuangan?tab=pengeluaran`.

### 6. Empty states linkable
- `RoastingClient.tsx:167-176` "Tidak ada Green Bean" → tombol link ke `/inventory` (Catat Barang Datang).
- `ProductionClient.tsx:138-149` → dua link: `/inventory` + `/roasting`.
- `QuickReceivePO.tsx:95-101` "Tidak ada PO" → link `/inventory?view=po`.

### 7. Bersih-bersih kecil
- Hapus `src/components/layout/OperatingHero.tsx` (dead code, tidak diimpor siapa pun).
- Biarkan `/master-data` shim (redirect aman) — dicatat untuk S2.
- Update badge pending-payment jika label berubah (Sidebar.tsx:422/:429 — hanya label).

## Verifikasi (gate)
1. `npx tsc --noEmit` — 0 error.
2. `pnpm vitest run` (unit; yang menyentuh nav/label: cek `ui-smoke.cjs` assertions, `tests/e2e/*` yang mengklaim label/tab — `product-information-architecture.spec.ts:78`, `core-operating-workspaces.spec.ts:90`).
3. Lint file berubah.
4. `RUN_INTEGRATION=true pnpm vitest run` — regresi (jalankan bila wajar; S1 murni UI).
5. Smoke: `scripts/ui-smoke.cjs` (kalau membutuhkan dev server & jalan di mesin ini).
6. Manual spot-check halaman utama via webapp-testing bila server lokal aktif: sidebar baru, breadcrumbs, link silang, `?tab=` keuangan.
7. Commit: `refactor(ui): simplify navigation into flow-based groups with breadcrumbs and cross-links`.

## Catatan / ditunda
- S2 (de-fragmentasi opname/pembayaran/kasir-penjualan) dan S3 (konsolidasi laporan + akuntansi masuk ReportLayout) — setelah review S1.
- Tidak ada perubahan schema/migrasi.
