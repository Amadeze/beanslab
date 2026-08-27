# Database Map

## Tenant dan akses

| Entitas | Tujuan | Ownership/lifecycle |
| --- | --- | --- |
| Tenant | Organisasi roastery, storefront, subscription, timezone | Root ownership |
| User | Anggota tenant dan role | `tenantId`; active/inactive |
| PasswordResetToken | Recovery credential | Hashed, expiring, single-use |
| SubscriptionPayment | Pembayaran plan | Tenant-scoped |

## Master dan operasi

| Entitas | Relasi utama | Catatan integritas |
| --- | --- | --- |
| Supplier | Purchase, PO | Tenant-scoped |
| Customer | Invoice | Tenant-scoped |
| Product | Recipe, purchase, roast, production, invoice, ledger | Type membedakan GB/RB/FG |
| Packaging | Recipe, purchase, production, ledger | Quantity unit |
| Machine | Roast/connector | Tenant-scoped, active flag |
| Recipe/RecipeItem | Product dan packaging | Komposisi produksi |
| PurchaseOrder/Item | Supplier dan item | Lifecycle PO aktual |
| Purchase | Supplier dan item | Penerimaan/pembelian executed |
| Parent/ChildRoastingBatch | Input/output product | Roasting lifecycle dan yield |
| ProductionBatch | Recipe/output/packaging | Konsumsi RB dan output FG |
| InventoryLedger | Product/packaging dan source reference | Riwayat stok immutable |

## Komersial dan finance

| Entitas | Tujuan |
| --- | --- |
| Invoice/InvoiceItem | Penjualan dan fulfillment |
| Payment | Penerimaan pembayaran |
| CreditNote/Item | Retur penjualan |
| SupplierPayment | Hutang supplier |
| Expense | Pengeluaran non-purchase |
| SampleUsage/Component | Konsumsi sample |

Money memakai `Decimal`; quantity dan weight dibedakan melalui field unit/kg/gram yang spesifik. Timezone tenant disimpan pada `Tenant.timezone`.

## Integrasi dan observability

- ArtisanPairingCode, RoastdStudio, ArtisanRoastImport, Roast, LiveSession.
- AuditLog, WebhookEvent, ReminderDelivery, JobRun, DailyBriefSnapshot, RateLimitBucket.

## Klasifikasi

- **Aman dipertahankan:** tenant ownership, Decimal money, ledger, audit/webhook inbox, operation idempotency.
- **Perlu dibersihkan:** komentar schema lama yang menyebut jumlah tabel dan brand internal secara tidak akurat.
- **Perlu diperbaiki bertahap:** index harus terus dibandingkan dengan query hot path; permission masih role enum.
- **Berisiko tinggi:** perubahan enum status, ledger ref, atau cascade tanpa migration dan audit data.
- **Belum diketahui:** kebutuhan warehouse, reservation, lot/expiry; tidak ada bukti cukup untuk menambahkannya.

