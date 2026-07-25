# User Workflows

## Supply

Supplier → purchase order → receiving/purchase → ledger `IN` → supplier payable/payment.

- PO tidak mengubah stok.
- Receiving menambah stok melalui ledger.
- Koreksi transaksi menggunakan void/reversal, bukan edit histori.

## Roasting

Green bean → parent/child roasting batch → machine/operator → ledger GB `OUT` → roasted bean `IN` → yield/loss → roast profile/import.

Artisan dapat memasukkan roast melalui pairing desktop, upload, atau webhook. Import duplikat ditangani oleh identity/idempotency.

## Production

Roasted bean + packaging + recipe → production batch → ledger material `OUT` → finished goods `IN` → estimated HPP.

Roasting dan produksi tetap dipisahkan agar konsumsi bahan tidak dihitung dua kali.

## Sales

Customer → invoice → fulfillment/shipping → payment → revenue reporting.

Storefront memakai alur invoice dan ledger yang sama. Retur membuat credit note dan ledger `RETURN_FG_IN`.

## Finance

Purchase/payable + expense + invoice/payment → P&L, balance sheet, cash, valuation, dan coffee flow.

Profit hanya ditampilkan dari model biaya yang tersedia; laporan harus menyebut periode dan basis data.

## Arsitektur Informasi Operasional

- **Pasokan** menyatukan posisi stok, pembelian, penerimaan, mutasi, dan supplier.
- **Roastery** menyatukan batch roasting, profil/log Artisan, serta produksi dan packing.
- **Penjualan** menyatukan invoice/pesanan, Kasir, sample, dan pelanggan.
- **Katalog** menampung produk, resep, harga, serta kemasan.
- **Pengaturan** menjadi rumah untuk profil organisasi, portal, anggota tim, mesin, koneksi Artisan, audit, serta paket dan tagihan.
- **Kasir** menangani penjualan langsung di toko: pencarian produk, keranjang, pelanggan, pembayaran tunai/QRIS/transfer, dan pencetakan nota.
- Checkout Kasir memakai mesin transaksi invoice, pembayaran, ledger, dan audit yang sama dengan modul Penjualan.

## Team dan platform

Tenant → user → role → server action guard → audit log.

Subscription tier → feature gate di UI dan server. Superadmin memiliki shell terpisah.
