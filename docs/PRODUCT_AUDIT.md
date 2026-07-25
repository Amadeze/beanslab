# Product Audit — roastr.id

Tanggal audit: 24 Juli 2026

## Ringkasan

roastr.id adalah SaaS multi-tenant untuk coffee roastery. Produk aktif menghubungkan master data, purchasing, inventory ledger, roasting, produksi, penjualan, pembayaran, pengeluaran, laporan, storefront tenant, subscription, audit, Midtrans, dan Artisan desktop sync.

Sumber kebenaran audit: route App Router, Server Actions, Prisma schema, migration, test, konfigurasi, dan UI aktual. Fitur yang hanya muncul sebagai kemungkinan tidak dipromosikan.

## Pengguna dan pekerjaan utama

| Role aktual | Pekerjaan utama | Risiko utama |
| --- | --- | --- |
| OWNER | Mengendalikan operasi, keuangan, tim, paket, dan pengaturan | Perubahan konfigurasi atau transaksi tidak sah |
| MANAGER | Mengelola seluruh operasi selain ownership/billing tertentu | Selisih stok, status, dan biaya |
| OPERATOR | Purchasing, inventory, roasting, produksi, dan mesin | Input quantity, unit, batch, atau yield yang salah |
| CASHIER | Customer, invoice, payment, dan retur | Overpayment, retur berlebih, atau akses stok yang tidak perlu |
| SUPERADMIN | Administrasi platform dan tenant | Kebocoran lintas tenant |

## Domain aktif

1. Ringkasan operasional
2. Purchasing dan penerimaan
3. Inventory dan ledger
4. Roasting dan roast profile
5. Produksi
6. Katalog produk dan kemasan
7. Penjualan, kasir, dan pelanggan
8. Keuangan dan laporan
9. Storefront tenant
10. Artisan, Midtrans, dan notifikasi
11. Organisasi, team, audit, billing, dan settings

## Temuan prioritas

### Sudah kuat

- `InventoryLedger` adalah sumber riwayat stok; cache stok diperbarui secara transaksional.
- Prisma tenant extension menambahkan filter `tenantId` dan memeriksa relasi milik tenant.
- Mutation utama memakai `requireRole()` dan runtime validation.
- Webhook memiliki signature check, inbox idempotent, audit, dan error handling.
- Route data-heavy mempunyai loading boundary dan production build berhasil.

### Diperbaiki dalam transformasi ini

- Brand user-facing pada shell, metadata, auth, billing, email, invoice, dan landing diubah ke `roastr.id`.
- Landing lama mengandung klaim absolut dan kontradiksi costing; diganti dengan copy berbasis fitur aktual.
- Harga landing sekarang membaca katalog plan aktual: Basic Rp149.000 dan Pro Rp299.000 per bulan.
- Guard role ditambahkan pada `createCreditNote`.
- Loading inventory diberi status aksesibel.
- Navigasi dikelompokkan menurut pekerjaan: Hari ini, Operasional, Komersial, Kontrol, dan Kelola.
- Monolit `Master Data` dihapus dari navigasi. Supplier, pelanggan, katalog, dan anggota tim kini berada pada domain pemiliknya.

### Risiko tersisa

- Banyak UI lama masih memakai pola visual glass dan bahasa campuran.
- Settings/storefront editor masih memakai beberapa tipe `any`; perlu migrasi bertahap.
- Role aktual masih coarse-grained; belum ada permission matrix per capability.
- CSP produksi masih membutuhkan `unsafe-inline`; migrasi nonce perlu diuji bersama Midtrans dan hydration.
- Upload lokal development memakai `public/uploads`; produksi sudah fail-closed bila object storage tidak tersedia.

## Keputusan produk

- Route dan nama teknis internal dipertahankan untuk kompatibilitas.
- Tidak ada perubahan schema atau migration dalam tahap ini.
- Landing tidak mengklaim multi-warehouse, FIFO, AI, offline, atau akurasi 100%.
- Route transaksi dan kontrak backend dipertahankan, tetapi entry point produk disusun ulang berdasarkan mental model pengguna.
