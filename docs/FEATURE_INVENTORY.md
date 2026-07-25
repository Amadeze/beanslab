# Feature Inventory

Status ditentukan dari bukti UI, handler server, schema, dan test.

| Fitur | Route/entry point | Backend/data | Role | Status | Catatan |
| --- | --- | --- | --- | --- | --- |
| Dashboard operasional | `/dashboard` | dashboard actions, DailyBriefSnapshot | OWNER, MANAGER | IMPLEMENTED | Decision-first; role lain mendapat akses terbatas dari shell |
| Supplier | `/inventory/suppliers` | Supplier, Purchase | OWNER, MANAGER, OPERATOR | IMPLEMENTED | Menjadi bagian workspace Pasokan |
| Pelanggan | `/penjualan/pelanggan` | Customer, Invoice | OWNER, MANAGER, CASHIER | IMPLEMENTED | Menjadi bagian workspace Penjualan |
| Katalog produk & kemasan | `/katalog` | Product, Recipe, Packaging | OWNER, MANAGER, OPERATOR | IMPLEMENTED | Dipisahkan dari data organisasi dan transaksi |
| Anggota tim | `/settings/team` | User, role | OWNER | IMPLEMENTED | Dipindahkan ke Pengaturan |
| Purchase langsung | `/inventory` | Purchase, ledger | OWNER, MANAGER, OPERATOR | IMPLEMENTED | Cash/partial/credit tersedia |
| Purchase order & receiving | `/inventory` | PurchaseOrder, PurchaseOrderItem | OWNER, MANAGER, OPERATOR | IMPLEMENTED | PO dibedakan dari penerimaan |
| Inventory ledger & adjustment | `/inventory` | InventoryLedger | OWNER, MANAGER, OPERATOR | IMPLEMENTED | Search/filter/export tersedia |
| Roasting batch | `/roasting` | Parent/ChildRoastingBatch | OWNER, MANAGER, OPERATOR | IMPLEMENTED | Complete/void dan stock impact |
| Roast profile/import | `/roasting?tab=profiles` | Roast, ArtisanRoastImport | OWNER, MANAGER, OPERATOR | IMPLEMENTED | Satu workspace dengan batch roasting; manual upload dan linking tersedia |
| Produksi barang jadi | `/produksi` | ProductionBatch, Recipe | OWNER, MANAGER, OPERATOR | IMPLEMENTED | Cost preview dan stock mutation |
| Invoice & retur | `/penjualan` | Invoice, Payment, CreditNote | OWNER, MANAGER, CASHIER | IMPLEMENTED | Retur mengembalikan FG ke ledger |
| Kasir offline | `/kasir` | Invoice, Payment, InventoryLedger | OWNER, MANAGER, CASHIER | IMPLEMENTED | POS task-specific; tunai/QRIS/transfer, cetak nota, stok memakai transaksi invoice existing |
| Sample usage | `/penjualan` | SampleUsage | Role penjualan/operasi | IMPLEMENTED | Jalur terpisah dari invoice |
| Supplier payable & expense | `/keuangan` | SupplierPayment, Expense | OWNER, MANAGER | IMPLEMENTED | Void correction tersedia |
| Laporan | `/laporan` | financial/reporting actions | OWNER, MANAGER + plan | IMPLEMENTED | Advanced reports di-gate plan |
| Storefront tenant | `/tenant/[subdomain]` | Tenant, Product | Publik | IMPLEMENTED | Theming, cart, checkout |
| Midtrans checkout | API billing/storefront | encrypted credential, webhook | Plan/tenant | IMPLEMENTED | Signature dan amount verification |
| Mesin & Artisan desktop sync | `/settings/machines`, `/settings/integrations/artisan` | Machine, pairing, connector, import, MQTT | Mesin OWNER/MANAGER; koneksi OWNER | IMPLEMENTED | Dikelompokkan dalam hub Pengaturan |
| Billing/subscription | `/billing` | SubscriptionPayment, plan catalog | OWNER | IMPLEMENTED | Trial/basic/pro/enterprise |
| Audit & jobs | `/audit` melalui Pengaturan | AuditLog, WebhookEvent, JobRun | OWNER/MANAGER | IMPLEMENTED | Reminder dan webhook views |
| Password recovery | auth routes | PasswordResetToken, email | Publik | IMPLEMENTED | Token hashed, expiring, single-use |
| Fine-grained custom permissions | Tidak ada | Tidak ada model Permission | — | PLANNED/UNKNOWN | Jangan dipromosikan sebagai configurable RBAC |
| Warehouse/multi-location | Tidak ada | Tidak ada model Warehouse | — | NOT IMPLEMENTED | Tidak dipromosikan |
