# Konfigurasi Production: Email, WhatsApp, dan Code Signing

Panduan ini memakai provider yang sudah terhubung di codebase Roastd: Resend untuk email dan Fonnte untuk WhatsApp. Jangan menaruh secret asli di Git. Masukkan semuanya melalui secret manager hosting.

## 1. Secret inti sebelum deploy

Generate tiga nilai berbeda, masing-masing minimal 32 karakter:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Jalankan perintah tersebut tiga kali, lalu simpan sebagai:

```dotenv
SESSION_SECRET="..."
CREDENTIAL_ENCRYPTION_KEY="..."
CRON_SECRET="..."
APP_URL="https://roastd.id"
NEXT_PUBLIC_APP_URL="https://roastd.id"
TENANT_ROOT_DOMAIN="roastd.id"
NEXT_PUBLIC_TENANT_ROOT_DOMAIN="roastd.id"
```

Untuk storefront tenant, pasang DNS wildcard `*.roastd.id` ke deployment yang sama dengan aplikasi dan aktifkan sertifikat TLS wildcard. Roastd akan me-rewrite `namatenant.roastd.id/` secara internal ke storefront tenant tanpa menampilkan `/tenant/namatenant` pada URL customer. `www`, `app`, `admin`, `api`, `mail`, `support`, `studio`, `status`, `docs`, dan `cdn` dicadangkan agar tidak dapat dipakai tenant.

Database saat ini memiliki tiga credential Midtrans lama dan semuanya telah terverifikasi bisa dipulihkan memakai `SESSION_SECRET` lama. Sebelum rotasi, ambil backup database. Setelah `CREDENTIAL_ENCRYPTION_KEY` baru dipasang, jalankan:

```powershell
$env:OLD_CREDENTIAL_ENCRYPTION_KEY="secret-lama"
pnpm security:rotate-credential-key
pnpm preflight:production
```

Hapus `OLD_CREDENTIAL_ENCRYPTION_KEY` setelah preflight berhasil. Jangan mengganti key produksi tanpa menjalankan rotasi ini.

## 2. Email transactional dengan Resend

1. Buat akun Resend dan tambahkan subdomain khusus, misalnya `mail.roastd.id`. Subdomain memisahkan reputasi email aplikasi dari domain utama.
2. Tambahkan record SPF dan DKIM yang diberikan Resend ke DNS domain.
3. Tunggu status domain menjadi `verified`.
4. Buat API key khusus production dengan izin mengirim.
5. Masukkan secret berikut pada hosting:

```dotenv
RESEND_API_KEY="re_xxxxxxxxx"
EMAIL_FROM="Roastd <notifikasi@mail.roastd.id>"
```

6. Verifikasi tanpa mengirim pesan:

```powershell
pnpm check:notifications
```

7. Uji kirim nyata dari customer POV: buat akun pilot dengan email Anda, gunakan `Lupa password`, lalu kirim satu invoice test. Pastikan nama pengirim, tombol, tautan HTTPS, folder spam, serta reply-to sesuai.

Catatan: domain `resend.dev` hanya cocok untuk pengujian ke alamat pemilik akun. Pengiriman ke customer membutuhkan domain milik sendiri yang sudah terverifikasi.

## 3. WhatsApp dengan Fonnte

1. Buat akun Fonnte, tambah satu device production, lalu hubungkan nomor WhatsApp bisnis melalui menu **Linked devices** dan scan QR.
2. Ambil **device token**, bukan account token. Jangan memasukkannya ke frontend.
3. Masukkan secret berikut pada hosting:

```dotenv
WA_API_URL="https://api.fonnte.com/send"
WA_API_KEY="token-device-fonnte"
```

4. Jalankan pemeriksaan. Script memanggil Device Profile dan tidak mengirim pesan:

```powershell
pnpm check:notifications
```

Status WhatsApp harus menunjukkan perangkat `connect`. Roastd mengirim nomor dalam format Indonesia `62...`, memakai `connectOnly=true`, timeout 15 detik, dan sekarang memperlakukan respons Fonnte `status:false` sebagai kegagalan meskipun HTTP-nya 200.

5. Dari **Pengaturan → Notifikasi**, aktifkan WhatsApp untuk tenant pilot. Buat satu invoice jatuh tempo dengan nomor Anda sendiri, kemudian jalankan:

```powershell
pnpm maintenance:overdue-reminders
```

Pastikan hanya satu pesan terkirim. Tabel `ReminderDelivery` mencegah pengiriman ulang channel yang sama pada tanggal yang sama.

## 4. Scheduler notification

Jadwalkan request `POST` minimal sekali sehari:

```text
POST https://roastd.id/api/cron/overdue-reminders
Authorization: Bearer <CRON_SECRET>
```

Gunakan scheduler hosting, bukan browser. Endpoint memakai idempotency harian sehingga retry aman.

## 5. Code signing Roastd Studio untuk Windows

Installer saat ini valid tetapi belum bertanda tangan. Untuk badan usaha Indonesia, jalur paling praktis adalah membeli sertifikat Authenticode OV atau EV dari CA tepercaya. Azure Artifact Signing Public Trust saat ini belum tersedia untuk entitas/individual Indonesia.

### Opsi A — sertifikat PFX atau cloud-export yang didukung CA

```powershell
$env:WIN_CSC_LINK="C:\secure\roastd-code-signing.pfx"
$env:WIN_CSC_KEY_PASSWORD="password-pfx"
cd desktop
npm run package:signed
```

`WIN_CSC_LINK` juga dapat berupa base64/URL yang disuntikkan oleh CI. Jangan simpan PFX atau password dalam repository.

### Opsi B — EV/hardware token atau Windows Certificate Store

Install middleware token dan sertifikat pada komputer build, lihat subject sertifikat dengan `certmgr.msc`, lalu:

```powershell
$env:ROASTD_CERTIFICATE_SUBJECT_NAME="Nama legal persis pada certificate CN"
cd desktop
npm run package:signed
```

Build bertanda tangan memakai `forceCodeSigning=true`, sehingga proses gagal jika sertifikat tidak terbaca. Setelah build, script otomatis memeriksa installer, executable Studio, dan device bridge. Pemeriksaan manual dapat diulang dengan:

```powershell
npm run verify:signature
```

Hasil harus `Valid` untuk semua executable. Timestamp SHA-256 penting agar signature tetap dipercaya setelah masa berlaku sertifikat selesai.

OV biasanya masih membutuhkan waktu membangun reputasi Microsoft SmartScreen. EV memberi reputasi awal lebih cepat tetapi lazimnya membutuhkan hardware token dan build Windows. Untuk pengalaman instalasi customer pertama, EV adalah pilihan paling kuat jika proses manual/token dapat diterima.

## 6. Gate customer POV setelah aplikasi online

1. Jalankan `pnpm preflight:production` sampai `ready: true`.
2. Jalankan `pnpm check:notifications` sampai kedua provider `ready: true`.
3. Download installer dari landing page menggunakan browser baru.
4. Pastikan Publisher di dialog Windows menampilkan nama legal pemilik sertifikat, bukan `Unknown publisher`.
5. Buat tenant pilot baru, login seperti customer, download Studio, authorize melalui browser, buat batch, hubungkan mesin, dan lakukan satu roast test.
6. Verifikasi `.alog`, Parent/Child Batch, stok, profile matching, dan audit trail masuk ke tenant yang benar.
