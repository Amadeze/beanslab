# Full Feature Audit — 29 Juli 2026

## Ringkasan eksekutif

Fondasi Roastd sudah kuat dan bukan lagi MVP kosong. Domain logic, integritas stok, akuntansi, isolasi tenant, build production, route utama, mobile layout, storefront themes, serta sync `.alog` memiliki bukti pengujian yang baik. Status keseluruhan saat audit: **layak staging/pilot, belum layak general production launch**.

Penghambat launch terkonsentrasi pada lima hal: konfigurasi production belum lengkap, checkout subscription Midtrans salah memilih script sandbox/production, lifecycle Quit Roastd Studio, installer belum code-signed, dan commerce loop tenant belum menutup ongkir–tracking–fulfillment.

## Bukti pengujian

| Area | Hasil |
|---|---:|
| Prisma schema | Valid |
| TypeScript | Lolos |
| ESLint quiet | Lolos |
| Unit/integration web | 236/236 lolos |
| Production build | Lolos, 64 halaman statis/dinamis |
| Audit stok | Tidak ada drift |
| Audit integritas data | Tidak ada violation |
| Audit isolasi tenant | 5/5 pemeriksaan lolos |
| UI smoke fitur baru | Lolos: cupping, lot, AI, notifikasi, pembelian, PO, penerimaan, storefront |
| Route sweep | 48/49 bersih; `/billing` memunculkan error Midtrans/CSP |
| E2E smoke inti | 5/6 lolos; readiness gagal karena environment/job production belum siap |
| E2E domain & visual | 9/10 lolos; satu assertion memakai label lama `Roastery`, UI sekarang `Roast` |
| Mobile 360 px | 13/13 lolos |
| Desktop Studio | 34/34 test lolos; TypeScript build lolos |
| Artisan device bridge | 12/12 test lolos |
| Installer Studio 0.9.2 | Ada, tetapi `NotSigned` |

## Yang sudah kuat

- Pembelian, PO, partial receiving, ongkir pembelian, metode pembayaran, ledger, dan jurnal.
- Inventory ledger, lot/FEFO, konsistensi stok, audit trail, dan tenant-scoped access.
- Roasting, produksi, profile/log, `.alog`, profile matching, cupping opsional, dan API Studio.
- Penjualan, kasir, pembayaran, retur, kontrak, laporan keuangan dan operasional.
- Tenant storefront, theme engine, katalog, tier pricing, cart, checkout, Midtrans webhook, dan subdomain routing.
- Superadmin, billing model, subscription webhook, authentication hardening, Docker, dan CI baseline.
- Layout mobile tidak overflow dan visual language utama konsisten.

## Temuan prioritas

### P0 — wajib sebelum customer production

1. **Production readiness endpoint masih 503.** Database reachable, tetapi configuration incomplete. Environment yang belum tersedia: `CREDENTIAL_ENCRYPTION_KEY`, `APP_URL`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `SUPABASE_STORAGE_BUCKET`. Email dan WhatsApp juga belum aktif.
2. **Operational jobs belum sehat.** Job `subscriptions` dan `overdue-reminders` belum pernah terobservasi; `daily-brief` stale. Deployment perlu scheduler nyata dan alert bila job terlambat.
3. **Billing Midtrans salah menentukan environment.** `BillingClient` memeriksa apakah client key mengandung kata `sandbox`; key sandbox Midtrans normalnya berawalan `SB-`. Akibatnya script production dapat dimuat dengan key sandbox. CSP juga belum mengizinkan host yang benar `app.sandbox.midtrans.com`.
4. **Quit Roastd Studio dapat tertahan.** Handler window `close` selalu memanggil `preventDefault()` dan hide-to-tray, termasuk ketika `app.quit()` dijalankan. Gunakan flag `isQuitting` dan tambahkan lifecycle test.
5. **Installer Studio belum ditandatangani.** `RoastdStudio-0.9.2-x64.exe` berstatus `NotSigned`; sebelum dibagikan ke customer perlu certificate, signed build, timestamp, dan verification di CI.

### P1 — menutup customer journey

1. **Ongkir storefront masih nol.** Checkout menerima metode dan alamat pengiriman, tetapi `grandTotal` belum memasukkan shipping/tax dan invoice menyimpan `shippingCost: 0`.
2. **Belum ada customer order tracking.** Pembeli memerlukan link/status: menunggu pembayaran → dibayar → diproduksi → dikemas → dikirim, termasuk resi.
3. **Reservasi stok belum eksplisit.** Checkout langsung mengeluarkan stok. Midtrans terminal failure mengembalikan stok, tetapi order manual/WhatsApp dan pending lama perlu expiry/release terjadwal.
4. **Order tenant belum otomatis menjadi fulfillment plan.** Kekurangan finished goods seharusnya menghasilkan kebutuhan roasting/packing, bukan berhenti sebagai invoice.
5. **Notification providers belum aktif.** Isi Resend dan Fonnte, uji domain/sender, template, retry, preference, dan delivery log.
6. **Object storage belum aktif.** Supabase storage diperlukan untuk upload yang persisten dan aman pada deployment multi-instance.

### P1 — quality dan delivery

1. **E2E full-suite terlalu lambat dan kurang observable.** Pecah menjadi project/suite domain, gunakan production server untuk release gate, reporter JUnit/HTML, dan timeout per domain.
2. **Satu test mobile stale.** Test mencari label `Roastery`, sedangkan UI yang benar menampilkan `Roast` menuju `/roasting`.
3. **Toolchain pnpm tidak reproducible di runner saat ini.** `packageManager` meminta pnpm 11.9.0 dan runtime mencoba menata ulang `node_modules`. Pin Node + Corepack/pnpm yang benar di developer setup dan CI.
4. **Knowledge graph tertinggal dari working tree.** Graph 27 Juli berguna sebagai baseline, tetapi banyak perubahan belum masuk commit. Regenerasi setelah working tree distabilkan.

### P1 — hardware validation Studio

1. Bridge, parser, simulator, `.alog`, MQTT, watcher, queue, dan build sudah teruji secara software.
2. Konfigurasi audit belum memiliki device adapter/serial port, sehingga pembacaan mesin fisik belum terverifikasi.
3. Wajib uji matriks minimal: satu Modbus TCP, satu USB/serial, disconnect/reconnect di tengah roast, 2–3 jam soak test, sensor dropout, restart recovery, kalibrasi BT/ET, dan validasi file `.alog` di Artisan.
4. Queue audit menunjukkan item yang akhirnya `UPLOADED` masih menyimpan `attempts/last_error` lama. Bersihkan metadata sukses agar UI/log tidak membingungkan operator.

### P2 — setelah pilot stabil

- Custom domain tenant, promo/kupon, pajak per tenant, shipping API, customer account/history.
- Demand aggregation dari storefront ke jadwal roasting dan rekomendasi batch.
- Full i18n framework dan opsi bahasa tenant.
- Performance budgets, accessibility sweep WCAG, serta visual regression terjadwal.

## Rencana perbaikan efisien

### Sprint A — Release blockers (1–2 hari engineering + proses sertifikat)

1. Perbaiki pemilihan Snap URL dan CSP Midtrans; tambahkan test `window.snap` siap pada sandbox.
2. Perbaiki lifecycle Quit Studio dan tambahkan automated Electron launch/quit test.
3. Pin Node/Corepack/pnpm, rapikan Playwright production-server command, dan perbarui assertion mobile.
4. Isi seluruh production environment, deploy migrations, aktifkan object storage, Resend, Fonnte, dan scheduler cron.
5. Pastikan `/api/health` menjadi 200 dan ketiga job berstatus fresh.
6. Sign installer 0.9.2 atau versi release berikutnya dan verifikasi signature di CI.

**Exit criteria:** production build hijau; health 200; notification/provider check hijau; installer signed; billing sandbox membuka Snap; Studio dapat launch dan quit otomatis.

### Sprint B — Tenant commerce loop (2–4 hari)

1. Tambahkan shipping rules sederhana per tenant terlebih dahulu: pickup, flat rate, gratis ongkir minimum.
2. Kalkulasi ongkir/pajak sepenuhnya di server dan ikutkan sebagai Midtrans item.
3. Implementasikan stock reservation dengan expiry dan scheduled release.
4. Tambahkan public order-status token, fulfillment status, resi, dan notifikasi WA/email.
5. Buat demand/fulfillment task otomatis saat stok finished goods tidak cukup.

**Exit criteria:** satu order storefront dapat berjalan end-to-end dari cart sampai resi tanpa koreksi database/manual workaround.

**Status 29 Juli 2026 — software complete:** rules pickup/delivery/flat/free-shipping/tax tersedia di `/settings/commerce`; checkout menghitung nilai server-side dan mengirim line ongkir/pajak ke Midtrans; reservasi stok memiliki expiry; order publik memiliki token dan halaman status; pembayaran manual/Midtrans mengonsumsi reservasi; resi memperbarui fulfillment dan memicu WA/email; shortage membuat task fulfillment yang otomatis dialokasikan oleh produksi. Antrean kerja tersedia di `/penjualan/fulfillment`. Migration `20260729200000_add_storefront_fulfillment` sudah diterapkan. Customer-provider test nyata tetap bagian Sprint D.

### Sprint C — Hardware confidence (2–3 hari + akses mesin)

1. Jalankan compatibility matrix perangkat nyata.
2. Uji reconnect, calibration, checkpoint recovery, `.alog` compatibility, dan profile matching.
3. Tambahkan diagnostic bundle sekali klik: config non-secret, device scan, version, dan recent logs.
4. Jalankan soak test dan perbaiki seluruh disconnect/data-gap issue.

**Exit criteria:** minimal dua kelas koneksi mesin lolos roast nyata dan hasilnya tersambung ke Parent/Child Batch serta profile matching.

**Status 29 Juli 2026 — software complete, hardware gate terbuka:** Tauri 0.10.2 memiliki reconnect eksponensial, kalibrasi, checkpoint, `.alog`, profile matching, penghitung gap, accelerated six-hour soak test, dan diagnostic report sekali klik dengan redaksi secret. Installer RC berhasil dibangun. Compatibility matrix dan bukti wajib ada di `desktop/HARDWARE_COMPATIBILITY.md`; dua kelas koneksi nyata belum boleh ditandai lulus sebelum perangkat tersedia. Installer juga masih unsigned dan karena itu belum melewati distribution gate.

### Sprint D — Pilot dan launch gate (2–4 hari kalender)

1. Deploy staging dengan wildcard `*.roastd.id`, TLS, backup, restore drill, Sentry, dan uptime alert.
2. Onboard 3–5 tenant pilot dari nol menggunakan setup checklist.
3. Jalankan skenario customer POV: setup → pembelian → roasting → produksi → storefront order → pembayaran → fulfillment → laporan.
4. Catat time-to-task, error, dan support request; hanya perbaiki friction berulang sebelum general launch.

**Exit criteria:** tiga tenant menyelesaikan golden path tanpa bantuan developer dan tidak ada P0 terbuka.

## Batas audit

Audit ini tidak melakukan charge Midtrans nyata, tidak mengirim email/WhatsApp karena key belum tersedia, dan tidak mengklaim kompatibilitas mesin fisik tanpa perangkat. Bagian-bagian tersebut harus menjadi launch gate eksternal, bukan dianggap lolos hanya karena unit test hijau.
