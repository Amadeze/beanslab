# Artisan Desktop Integration

## Arsitektur

```
Artisan Software
    │ menyimpan file .alog
    ▼
Folder Autosave lokal
    │ dipantau oleh Artisan Sync
    ▼
Artisan Sync (Desktop App)
    │ HTTPS
    ▼
Node.js API (ROS Backend)
    │
    ▼
Tenant → Machine → Roast Import → RoastingBatch
```

Desktop app tidak berkomunikasi langsung dengan Artisan. App hanya memantau folder Autosave yang dikonfigurasi.

## Alur Pairing

1. User login ke dashboard ROS
2. Buka **Settings → Integrasi Artisan** atau sidebar **Integrasi Artisan**
3. Pilih mesin roasting yang sudah dibuat di **Master Data → Mesin Roasting**
4. Klik **"Hubungkan Artisan"**
5. Dashboard menampilkan kode 6-digit (berlaku 10 menit, sekali pakai)
6. User install **Artisan Sync** di komputer Windows
7. Masukkan kode 6-digit di aplikasi
8. Aplikasi otomatis mendapatkan credential dan terhubung

## Alur Upload

1. Artisan menyimpan file `.alog` ke folder Autosave
2. Artisan Sync memantau folder tersebut (chokidar)
3. File yang stabil (tidak berubah selama 5 detik) dimasukkan ke antrian
4. File dihitung SHA-256 untuk deduplikasi
5. File diupload ke backend via multipart/form-data
6. Backend memvalidasi: ekstensi .alog, ukuran, hash
7. Import disimpan dengan status (UPLOADED → IMPORTED/FAILED)
8. File yang sama tidak akan diupload dua kali (idempotency)

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
# Output: desktop/release/ArtisanSync-1.0.0-Setup.exe
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
2. Atau buka: `%APPDATA%/Roastery OS/Artisan Sync/logs/`
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

- Pairing code dihash dengan pepper sebelum disimpan di database
- Connector token dihash dengan pepper dan disimpan di database
- Credential tidak pernah ditampilkan setelah pairing pertama
- Tenant ID dan Machine ID selalu diambil dari pairing code, bukan dari request desktop app
- Rate limiting diterapkan pada pairing dan upload endpoint
- Audit log dicatat untuk pair, revoke, upload, import failure, dan auto-match
- Bearer token tidak pernah di-log
- HTTPS wajib di production

## Known Limitations

1. Desktop app hanya mendukung Windows (Electron + portable installer)
2. Credential storage menggunakan JSON encryption — production sebaiknya menggunakan Windows Credential Manager via keytar
3. Auto-launch menggunakan registry approach — production sebaiknya menggunakan `auto-launch` package
4. Parser `.alog` sudah diimplementasi dengan dummy format — perlu validasi dengan file Artisan asli

## Customer Quick Start

1. Aktifkan Autosave `.alog` di Artisan
2. Install **Artisan Sync** dari link download di dashboard
3. Masukkan kode pairing 6 digit
4. Pilih folder Autosave Artisan
5. Lakukan roast seperti biasa — file otomatis terkirim ke ROS
