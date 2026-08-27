# Artisan Desktop Integration

## Arsitektur

```
Artisan Software
    │ menyimpan file .alog
    ▼
Folder Autosave lokal
    │ dipantau oleh Roastd Studio
    ▼
Roastd Studio (Desktop App)
    │ HTTPS
    ▼
Node.js API (ROS Backend)
    │
    ▼
Tenant → Machine → Roast Import → RoastingBatch
```

Roastd Studio bersifat read-only: app membaca telemetry MQTT bila tersedia dan memantau folder Autosave Artisan. Studio tidak mengontrol burner, fan, atau aktuator mesin.

## Alur Login Studio

1. User install dan membuka **Roastd Studio** di komputer Windows
2. Klik **Masuk dengan Roastd**; Studio membuka browser default
3. Jika belum login, user masuk memakai akun Roastd
4. Owner memilih mesin roasting untuk komputer tersebut
5. Klik **Izinkan dan hubungkan**
6. Studio menerima token connector khusus mesin dan tersambung otomatis

Password dan cookie akun tidak disimpan di desktop. Device authorization berlaku 10 menit, menggunakan dua secret terpisah untuk browser dan polling desktop, serta hanya dapat dikonsumsi sekali.

## Alur Upload

1. Artisan menyimpan file `.alog` ke folder Autosave
2. Roastd Studio memantau folder tersebut (chokidar)
3. File yang stabil (tidak berubah selama 5 detik) dimasukkan ke antrian
4. File dihitung SHA-256 untuk deduplikasi
5. File diupload ke backend via multipart/form-data
6. Backend memvalidasi: ekstensi .alog, ukuran, hash
7. File mentah disimpan di private object storage untuk audit dan reprocessing
8. Import disimpan dengan status (UPLOADED → IMPORTED/FAILED)
9. File yang sama tidak akan diupload dua kali (idempotency)

## Auto-Match Roast ke Batch

Saat file .alog diupload dan di-parse:
1. Sistem mencari ParentRoastingBatch PENDING dengan `machineId` yang sama
2. Sistem mencari ChildRoastingBatch dalam batch tersebut yang belum terisi (`roastId = null`)
3. Roast otomatis di-link ke ChildRoastingBatch pertama yang kosong
4. Tidak perlu link manual!

## Auto-Split Batch

Saat membuat batch dengan `targetWeightKg` melebihi kapasitas mesin:
1. Sistem menghitung: `splits = ceil(targetWeight / capacity)`
2. Sistem membuat `splits` ChildRoastingBatch otomatis
3. Setiap ChildRoastingBatch bisa di-link ke roast profile berbeda

Contoh: Batch 10kg dengan mesin 1.5kg → 7 ChildRoastingBatch

## Environment Variables

### Backend (ROS)

| Variable | Required | Description |
|---|---|---|
| `ARTISAN_CONNECTOR_TOKEN_PEPPER` | No | Pepper for hashing connector tokens |
| `ARTISAN_PAIRING_CODE_PEPPER` | No | Pepper for hashing pairing codes |
| `ARTISAN_MAX_UPLOAD_BYTES` | No | Max upload size (default: 10MB) |
| `ARTISAN_CONNECTOR_DOWNLOAD_URL` | No | Download URL for desktop installer |

### Desktop App

| Variable | Description |
|---|---|
| `ARTISAN_SYNC_API_BASE_URL` | Backend API URL (baked at build time) |

## Local Development

### Backend

```bash
cd ros-app
pnpm install
npx prisma migrate dev
pnpm dev
```

### Desktop App

```bash
cd desktop
npm install
npm run dev
```

## Build

### Backend

```bash
cd ros-app
pnpm build
```

### Desktop Installer

```bash
cd desktop
npm run build
npm run package:portable
# Output: desktop/release/RoastdStudio-0.3.0-x64.exe
```

## Revoke Connector

1. Buka **Settings → Integrasi Artisan** atau sidebar **Integrasi Artisan**
2. Cari connector yang ingin dicabut
3. Klik ikon ** unlink** (Putuskan)
4. Konfirmasi
5. Desktop app akan menampilkan status "Autentikasi Kedaluwarsa"

## Melihat Log

### Backend
Log backend menggunakan structured JSON ke stdout/stderr.

### Desktop App
1. Klik **"Buka Log"** di aplikasi
2. Atau buka folder log dari panel Roastd Studio
3. Log dirotasi otomatis (5 file, 5MB per file)

## Menambahkan Sample `.alog`

File sample ada di `ros-app/src/lib/artisan/__tests__/fixtures/`.

Untuk menambah sample baru:
1. Letakkan file `.alog` di folder tersebut
2. Jalankan test: `pnpm test`

## Reprocess Import Gagal

Import dengan status `FAILED` tetap disimpan di database beserta:
- `errorCode`: jenis error
- `errorMessage`: deskripsi error
- `storageKey`: lokasi file raw

Untuk reprocess:
1. Perbaiki parser
2. Jalankan script migrasi untuk memproses ulang import yang gagal

## Security Notes

- Device code dan verification code disimpan hanya dalam bentuk hash
- Connector token dihash dengan pepper dan disimpan di database
- Credential tidak pernah ditampilkan setelah otorisasi pertama
- Tenant ID dan Machine ID ditentukan oleh owner dari session browser, bukan request desktop
- Rate limiting diterapkan pada device login, polling, dan upload endpoint
- Audit log dicatat untuk pair, revoke, upload, import failure, dan auto-match
- Bearer token tidak pernah di-log
- HTTPS wajib di production

## Known Limitations

1. Desktop app hanya mendukung Windows (Electron + portable installer)
2. Credential storage menggunakan JSON encryption — production sebaiknya menggunakan Windows Credential Manager via keytar
3. Auto-launch menggunakan registry approach — production sebaiknya menggunakan `auto-launch` package
4. Kompatibilitas `.alog` perlu diuji ulang setiap ada versi mayor Artisan baru

## Customer Quick Start

1. Aktifkan Autosave `.alog` di Artisan
2. Install **Roastd Studio** dari link download di dashboard
3. Klik **Masuk dengan Roastd**, login di browser, dan pilih mesin
4. Pilih folder Autosave Artisan jika belum terdeteksi
5. Lakukan roast seperti biasa — file otomatis terkirim ke ROS
