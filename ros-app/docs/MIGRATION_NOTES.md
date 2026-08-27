# Migration Notes

## Database

Tidak ada perubahan schema atau migration pada transformasi ini.

## Route dan API

Kontrak API dan route transaksi tidak berubah. Entry point baru ditambahkan untuk `/katalog`, `/inventory/suppliers`, `/penjualan/pelanggan`, dan `/settings/team`. `/master-data` dipertahankan sebagai redirect berbasis konteks agar bookmark lama tetap bekerja.

## Brand compatibility

### Safe to rename

- Metadata, landing, shell, auth copy, billing copy, email sender/copy, invoice footer.

### Compatibility required

- Package name `ros-app`.
- Cookie `ros_session`.
- Storage bucket default `ros-assets`.
- Desktop application identifiers dan install path.
- Internal email/seed identifiers.
- Environment variables dan API route.

## UI system migration

- Semantic material tokens ditambahkan tanpa mengubah kontrak data.
- Tailwind family lama (`blue`, `fuchsia`, `violet`, dan lainnya) dipetakan ke material palette sebagai compatibility bridge.
- Cyan tidak lagi menjadi global action color; pemakaiannya dibatasi untuk live state, koneksi, dan telemetry.
- Navigation aktif memakai warna domain sesuai tahap bisnis.
- Auth, superadmin, print, dashboard, workspace, settings, reports, billing, dan shared primitives memakai foundation yang sama.
- Storefront tenant tetap themable agar identitas tenant tidak tertimpa identitas operating system.
- Tidak ada URL, action contract, atau permission model yang berubah karena redesign.

### Keep internal

- Class prefix `ros-*`, script names, historical migration comments, and job/workflow identifiers where renaming risks deployment compatibility.

## Plan and pricing

Landing reads values from `PLAN_CATALOG`; plan price changes should be made in one source. No annual price is advertised because it is not represented by the current catalog.

## Rollback

UI/copy changes can be reverted without data migration. The role guard is security-relevant and should not be removed.
