# Route Map

## Public dan authentication

| Route | Tujuan |
| --- | --- |
| `/` | Landing roastd.id |
| `/login`, `/register` | Authentication dan pembuatan tenant |
| `/forgot-password`, `/reset-password` | Recovery |
| `/tenant/[subdomain]` | Storefront publik tenant |
| `/nota/[id]`, `/invoice/[id]/print` | Dokumen transaksi |

## Tenant workspace

| Kelompok navigasi | Route |
| --- | --- |
| Hari ini | `/dashboard`, `/control-tower` |
| Operasional â€” Pasokan | `/inventory`, `/inventory?view=po`, `/inventory?view=receiving`, `/inventory?view=mutations`, `/inventory/suppliers` |
| Operasional â€” Roastery | `/roasting`, `/roasting?tab=profiles`, `/produksi` |
| Komersial | `/kasir`, `/penjualan`, `/penjualan/pelanggan` |
| Kontrol | `/keuangan`, `/laporan` |
| Kelola | `/katalog`, `/settings`, `/settings/organization`, `/settings/team`, `/settings/machines`, `/settings/integrations/artisan`, `/audit`, `/billing` |

## Platform admin

| Route | Tujuan |
| --- | --- |
| `/superadmin/dashboard` | Ringkasan platform |
| `/superadmin/tenants` | Manajemen tenant |

Superadmin dipisahkan dari tenant shell.

## API groups

- `/api/tenant/[subdomain]/checkout`: checkout storefront.
- `/api/billing/checkout`: pembayaran subscription.
- `/api/webhooks/*`: Artisan dan Midtrans.
- `/api/integrations/artisan/*`: pairing, connector, MQTT, upload, status.
- `/api/roasting/*`: batch, linking, manual upload.
- `/api/cron/*`: subscriptions, reminders, daily brief.
- `/api/settings/*`: test Midtrans dan webhook logs.
- `/api/upload`: image upload tenant.
- `/api/health*`: readiness dan liveness.

## Compatibility

Route berbahasa Indonesia dipertahankan. `/roasting/roasts` mengarah ke profil roasting dan `/master-data/machines` mengarah ke mesin dalam Pengaturan. `/master-data` kini merupakan route compatibility yang mengarahkan supplier ke Pasokan, pelanggan ke Penjualan, anggota ke Pengaturan, serta produk/kemasan ke Katalog.
