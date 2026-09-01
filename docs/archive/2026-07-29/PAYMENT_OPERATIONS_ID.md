# SOP Pembayaran Tenant

Dokumen ini menetapkan alur pembayaran pelanggan untuk setiap tenant roastd.id. Rekening atau QRIS milik tenant adalah jalur produksi utama. Xendit disiapkan sebagai jalur tambahan dan tidak boleh diaktifkan sebelum seluruh gate pada bagian terakhir lulus.

## 1. Setup wajib tenant

1. Owner membuka **Pengaturan → Pembayaran Portal**.
2. Tambahkan minimal satu rekening bank atau gambar QRIS yang valid.
3. Pastikan nama pemilik rekening, nomor rekening, dan instruksi cocok dengan rekening bisnis tenant.
4. Aktifkan metode tersebut. Onboarding tidak dapat diselesaikan tanpa minimal satu metode aktif.

## 2. Pembayaran pelanggan

1. Pelanggan memilih tujuan pembayaran pada halaman pesanan.
2. Pelanggan mentransfer dana dan mengisi **nominal yang benar-benar ditransfer**.
3. Pelanggan mengunggah JPG, PNG, atau WebP maksimal 5 MB.
4. Sistem menyimpan bukti di bucket privat, menghitung hash SHA-256, dan menandai referensi/file yang pernah dipakai.
5. Status menjadi **Perlu dicek**. Pada tahap ini belum ada kas, jurnal, atau perubahan status invoice.

## 3. Verifikasi tenant

1. Buka **Penjualan → Bukti bayar** atau klik badge merah pada Penjualan.
2. Cocokkan tujuan rekening, nama pengirim, nominal, tanggal, dan referensi dengan mutasi bank/QRIS.
3. Bila cocok, isi nominal yang diterapkan lalu klik **Verifikasi**.
4. Sistem membuat Payment dan jurnal kas secara atomik. Invoice menjadi **Partial** atau **Paid** sesuai total yang diterapkan.
5. Bila tidak cocok, isi alasan singkat lalu klik **Tolak**. Pelanggan dapat mengunggah bukti baru pada tautan yang sama.

## 4. Kasus khusus

- **Pembayaran partial:** terapkan hanya nominal yang benar-benar masuk. Sisa invoice tetap piutang.
- **Nominal berbeda:** jangan mengubah nominal bukti. Terapkan nilai aktual yang tervalidasi.
- **Potensi duplikat:** buka bukti pembanding. Centang konfirmasi hanya jika mutasi bank membuktikan transaksi memang berbeda.
- **Kelebihan bayar:** sistem sengaja memblokir verifikasi. Kembalikan kelebihan dana dan simpan referensi refund, atau tunggu fitur deposit pelanggan/liabilitas tersedia. Jangan membukukan kelebihan sebagai pendapatan.
- **Bukti palsu/tidak terbaca:** tolak dengan alasan yang dapat ditindaklanjuti.
- **Kedaluwarsa:** buat instruksi pembayaran baru; jangan menghidupkan token lama secara manual.
- **Notifikasi gagal:** keputusan pembayaran tetap sah. Periksa konfigurasi provider dan tabel `payment_notification_deliveries`, lalu hubungi pelanggan secara manual bila perlu.

## 5. Refund

Refund belum diotomasi. Owner/manager wajib:

1. Memastikan pembayaran asli sudah terverifikasi.
2. Mendapat persetujuan internal sesuai kebijakan tenant.
3. Mengirim refund ke sumber pembayaran yang tervalidasi.
4. Menyimpan bukti dan nomor referensi refund pada audit operasional.
5. Membuat credit note/retur bila refund berasal dari pembatalan barang. Jangan menghapus Payment yang sudah sah.

## 6. Gate aktivasi Xendit xenPlatform

Adapter API sudah tersedia tetapi checkout belum dihubungkan. Aktivasi hanya dilakukan setelah:

1. Akun xenPlatform master disetujui.
2. Model sub-account tenant dipilih dan alur KYC/representative verification lulus.
3. Setiap tenant memiliki `xenditSubAccountId` yang benar.
4. `XENDIT_SECRET_KEY` dan `XENDIT_WEBHOOK_TOKEN` tersedia di secret manager.
5. Webhook dibuat idempotent, terverifikasi, dan diuji terhadap replay.
6. QRIS/payment request sandbox, partial failure, expiry, refund, settlement, dan rekonsiliasi lulus E2E.
7. `XENDIT_ENABLED=true` baru dipasang setelah preflight produksi hijau.

Referensi resmi: [xenPlatform overview](https://docs.xendit.co/docs/xenplatform-overview), [sub-account setup](https://docs.xendit.co/docs/xenplatform-global-accounts-setup), [Payment Request API](https://docs.xendit.co/apidocs/create-payment-request), dan [testing xenPlatform](https://docs.xendit.co/docs/testing-xenplatform-features).
