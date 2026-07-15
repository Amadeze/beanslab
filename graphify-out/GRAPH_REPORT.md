# Graph Report - .  (2026-07-14)

## Corpus Check
- Large corpus: 193 files · ~1,153,043 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 948 nodes · 1973 edges · 115 communities (78 shown, 37 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Finance & Payments
- Finance & Payments
- Project Configuration
- Project Configuration
- Dashboard & Shell
- Production Workflow
- Superadmin Portal
- Finance & Payments
- Master Data Management
- Sales & Invoicing
- Sales & Invoicing
- components.json Details
- Production Workflow
- Roasting Operations
- Finance & Payments
- Finance & Payments
- Master Data Management
- UI Components
- Finance & Payments
- Finance & Payments
- Master Data Management
- UI Components
- Multi-tenant Portal
- UI Components
- Finance & Payments
- Finance & Payments
- Master Data Management
- Dashboard & Shell
- Sales & Invoicing
- UI Components
- Master Data Management
- Master Data Management
- Superadmin Portal
- Project Configuration
- scratch_new_layouts.js Details
- create-admin.js Details
- Database Models
- scratch_fix_bg.js Details
- scratch_fix_icons.js Details
- scratch_light_glass.js Details
- scratch_light_glass2.js Details
- scratch_theme.js Details
- scratch_add_6_layouts.js Details
- scratch_fix_hero_image.js Details
- scratch_fix_modern2.js Details
- scratch_inject_animations.js Details
- Superadmin Portal
- adapter Details
- Dashboard & Shell
- proxy.ts Details
- Local Maintenance Scripts
- Payroll Management
- scratch_check_images.js Details
- test_db.js Details
- seed_subdomain.js Details
- CLAUDE.md Guide Details
- check_data.mjs Details
- scratch_replace.js Details
- replace_actions.js Details
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- eslint.config.mjs Details
- Framework Settings
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- Project Configuration
- ros-app README Details
- postcss.config.mjs Details
- RootPage Details

## God Nodes (most connected - your core abstractions)
1. `cn()` - 118 edges
2. `requireTenantPrisma()` - 67 edges
3. `formatRupiah()` - 41 edges
4. `Button()` - 35 edges
5. `Input()` - 22 edges
6. `StandardPageLayout()` - 18 edges
7. `Label()` - 18 edges
8. `getSystemUserId()` - 18 edges
9. `formatKg()` - 16 edges
10. `formatDate()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `ReadonlyField()` --calls--> `cn()`  [EXTRACTED]
  ros-app/src/app/(dashboard)/inventory/_components/PurchaseForm.tsx → ros-app/src/lib/utils.ts
- `PaymentMethodGroup()` --calls--> `cn()`  [EXTRACTED]
  ros-app/src/app/(dashboard)/penjualan/_components/InvoiceForm.tsx → ros-app/src/lib/utils.ts
- `NavItem()` --calls--> `cn()`  [EXTRACTED]
  ros-app/src/components/layout/Sidebar.tsx → ros-app/src/lib/utils.ts
- `AlertDialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  ros-app/src/components/ui/alert-dialog.tsx → ros-app/src/lib/utils.ts
- `AlertDialogMedia()` --calls--> `cn()`  [EXTRACTED]
  ros-app/src/components/ui/alert-dialog.tsx → ros-app/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (115 total, 37 thin omitted)

### Community 0 - "Finance & Payments"
Cohesion: 0.05
Nodes (59): FormValues, PackagingOption, PackagingPurchaseFormProps, purchaseSchema, quickAddSchema, QuickAddValues, SupplierOption, FormValues (+51 more)

### Community 1 - "Finance & Payments"
Cohesion: 0.07
Nodes (56): ActionResult, adjustStock(), createGreenBeanPurchase(), createPackaging(), createPackagingPurchase(), fetchFGStocks(), fetchPackagingStocks(), fetchProductStocks() (+48 more)

### Community 2 - "Project Configuration"
Cohesion: 0.06
Nodes (34): eslint, eslint-config-next, prisma, devDependencies, eslint, eslint-config-next, prisma, tailwindcss (+26 more)

### Community 3 - "Project Configuration"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+22 more)

### Community 4 - "Dashboard & Shell"
Cohesion: 0.11
Nodes (23): ActivityItem, DashboardData, DashboardKpi, getDashboardData(), KgAggRow, LowStockItem, RevenueTrend, TopCustomer (+15 more)

### Community 5 - "Production Workflow"
Cohesion: 0.13
Nodes (24): createProductionBatch(), CreateProductionBatchInput, fetchBatchHistory(), fetchFGOptions(), fetchPackagingOptions(), fetchRBOptions(), FGProductOption, generateBatchCode() (+16 more)

### Community 7 - "Finance & Payments"
Cohesion: 0.15
Nodes (20): FormValues, METHODS, schema, CustomerOption, FGStockOption, InvoiceRow, SalesClient(), SalesClientProps (+12 more)

### Community 8 - "Master Data Management"
Cohesion: 0.09
Nodes (24): ActionResult, createCustomer(), CreateCustomerInput, CreatePackagingInput, CreateProductInput, CreateSupplierInput, createUser(), CreateUserInput (+16 more)

### Community 9 - "Sales & Invoicing"
Cohesion: 0.12
Nodes (19): approveInvoiceForMidtrans(), CreateInvoiceInput, getInvoiceForPrint(), getSalesPageData(), InvoiceItemInput, InvoicePrintData, SalesActionResult, SalesPageData (+11 more)

### Community 10 - "Sales & Invoicing"
Cohesion: 0.11
Nodes (21): createInvoice(), FormValues, InvoiceForm(), InvoiceFormProps, itemSchema, PAYMENT_METHODS, PaymentMethodGroup(), schema (+13 more)

### Community 11 - "components.json Details"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "Production Workflow"
Cohesion: 0.16
Nodes (17): LowStockCard(), FGStockRow, GBProductOption, PackagingStockRow, ProductStockRow, SupplierOption, InventoryClient(), InventoryClientProps (+9 more)

### Community 13 - "Roasting Operations"
Cohesion: 0.16
Nodes (19): createRoastingBatch(), CreateRoastingBatchInput, fetchBatchHistory(), fetchGBOptions(), fetchRBOptions(), GBStockOption, generateBatchCode(), generateRBCode() (+11 more)

### Community 14 - "Finance & Payments"
Cohesion: 0.15
Nodes (11): PiutangTable(), PurchaseTable(), ProductionHistoryTable(), ProductionHistoryTableProps, RoastingHistoryTable(), RoastingHistoryTableProps, InvoicePrintPage(), PrintTrigger() (+3 more)

### Community 15 - "Finance & Payments"
Cohesion: 0.15
Nodes (3): StandardPageLayout(), StandardPageLayoutProps, Skeleton()

### Community 16 - "Master Data Management"
Cohesion: 0.11
Nodes (10): MasterPageData, ALL_TABS, getTabsForRole(), MasterDataClient(), MasterDataClientProps, PROD_TYPE_COLOR, PROD_TYPE_FULL, PROD_TYPE_LABEL (+2 more)

### Community 17 - "UI Components"
Cohesion: 0.15
Nodes (14): DialogOverlay(), PopoverContent(), PopoverDescription(), PopoverHeader(), PopoverTitle(), SheetContent(), SheetDescription(), SheetFooter() (+6 more)

### Community 18 - "Finance & Payments"
Cohesion: 0.25
Nodes (14): CATEGORY_COLOR, CATEGORY_LABEL, CATEGORY_COLOR, CATEGORY_LABEL, CATEGORY_MAP, exportToCSV(), InventoryValuationClient(), InventoryValuationClientProps (+6 more)

### Community 19 - "Finance & Payments"
Cohesion: 0.17
Nodes (13): BillingClient(), PnLReport, CATEGORY_LABELS, exportToCSV(), KpiCard(), KpiCardProps, LineRow(), LineRowProps (+5 more)

### Community 20 - "Master Data Management"
Cohesion: 0.23
Nodes (7): getMasterData(), MasterDataPage(), AppSession, LoginResult, logoutAction(), SESSION_OPTIONS, SessionUser

### Community 21 - "UI Components"
Cohesion: 0.21
Nodes (11): AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia() (+3 more)

### Community 22 - "Multi-tenant Portal"
Cohesion: 0.18
Nodes (10): ExtendedTenant, fadeBlur, fadeInUp, staggerContainer, TenantPortalClient(), TenantPortalClientProps, TenantPageProps, CartItem (+2 more)

### Community 23 - "UI Components"
Cohesion: 0.18
Nodes (7): geistMono, geistSans, metadata, viewport, Toaster(), TooltipContent(), TooltipProvider()

### Community 24 - "Finance & Payments"
Cohesion: 0.23
Nodes (5): PiutangRow, PiutangTableProps, TerimaPaymentDialogProps, Button(), buttonVariants

### Community 25 - "Finance & Payments"
Cohesion: 0.21
Nodes (10): ExpenseRow, KeuanganPageData, PurchaseRow, ExpenseTable(), ExpenseTableProps, KeuanganClientProps, KpiCardProps, Tab (+2 more)

### Community 26 - "Master Data Management"
Cohesion: 0.25
Nodes (10): createProduct(), ProductRow, updateProduct(), FormValues, PRODUCT_TYPES, ProductForm(), ProductFormProps, recipeItemSchema (+2 more)

### Community 27 - "Dashboard & Shell"
Cohesion: 0.27
Nodes (5): AppShell(), PageTransition(), NAV_ITEMS, NavItem(), Sidebar()

### Community 28 - "Sales & Invoicing"
Cohesion: 0.29
Nodes (6): voidInvoice(), InvoiceTable(), STATUS_MAP, triggerSilentPrint(), Badge(), badgeVariants

### Community 29 - "UI Components"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 30 - "Master Data Management"
Cohesion: 0.36
Nodes (7): createPackaging(), PackagingRow, updatePackaging(), FormValues, PackagingForm(), PackagingFormProps, schema

### Community 31 - "Master Data Management"
Cohesion: 0.36
Nodes (7): createSupplier(), SupplierRow, updateSupplier(), FormValues, schema, SupplierForm(), SupplierFormProps

### Community 32 - "Superadmin Portal"
Cohesion: 0.43
Nodes (3): createTenant(), TenantForm(), main()

### Community 33 - "Project Configuration"
Cohesion: 0.29
Nodes (7): @base-ui/react, bcryptjs, dependencies, @base-ui/react, bcryptjs, zustand, zustand

### Community 34 - "scratch_new_layouts.js Details"
Cohesion: 0.29
Nodes (6): content, fs, lastBrace, path, startIndex, targetPath

### Community 35 - "create-admin.js Details"
Cohesion: 0.29
Nodes (5): adapter, bcrypt, prisma, { PrismaClient }, { PrismaPg }

### Community 36 - "Database Models"
Cohesion: 0.47
Nodes (5): adapter, daysAgo(), daysFromNow(), main(), prisma

### Community 37 - "scratch_fix_bg.js Details"
Cohesion: 0.33
Nodes (4): DIRECTORIES, fs, path, REPLACEMENTS

### Community 38 - "scratch_fix_icons.js Details"
Cohesion: 0.33
Nodes (5): content, fs, icons, path, targetPath

### Community 39 - "scratch_light_glass.js Details"
Cohesion: 0.33
Nodes (4): DIRECTORIES, fs, path, REPLACEMENTS

### Community 40 - "scratch_light_glass2.js Details"
Cohesion: 0.33
Nodes (4): DIRECTORIES, fs, path, REPLACEMENTS

### Community 41 - "scratch_theme.js Details"
Cohesion: 0.33
Nodes (4): DIRECTORIES, fs, path, REPLACEMENTS

### Community 42 - "scratch_add_6_layouts.js Details"
Cohesion: 0.40
Nodes (4): content, fs, path, targetPath

### Community 43 - "scratch_fix_hero_image.js Details"
Cohesion: 0.40
Nodes (4): content, fs, path, targetPath

### Community 44 - "scratch_fix_modern2.js Details"
Cohesion: 0.40
Nodes (4): content, filePath, fs, path

### Community 45 - "scratch_inject_animations.js Details"
Cohesion: 0.40
Nodes (4): content, fs, path, targetPath

### Community 46 - "Superadmin Portal"
Cohesion: 0.40
Nodes (3): adapter, pool, prisma

### Community 47 - "adapter Details"
Cohesion: 0.40
Nodes (3): adapter, pool, prisma

### Community 48 - "Dashboard & Shell"
Cohesion: 0.50
Nodes (3): updateTenantSettings(), ExtendedTenant, SettingsClient()

### Community 49 - "proxy.ts Details"
Cohesion: 0.60
Nodes (4): config, proxy(), PUBLIC_PATHS, ROOT_DOMAINS

### Community 55 - "CLAUDE.md Guide Details"
Cohesion: 0.67
Nodes (3): CLAUDE.md Guide, ros-app AGENTS.md, ros-app CLAUDE.md

## Knowledge Gaps
- **320 isolated node(s):** `{ PrismaClient }`, `prisma`, `$schema`, `style`, `rsc` (+315 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `UI Components` to `Finance & Payments`, `Finance & Payments`, `Production Workflow`, `Finance & Payments`, `Sales & Invoicing`, `Production Workflow`, `Roasting Operations`, `Finance & Payments`, `Finance & Payments`, `Master Data Management`, `Finance & Payments`, `Finance & Payments`, `UI Components`, `UI Components`, `Finance & Payments`, `Finance & Payments`, `Master Data Management`, `Dashboard & Shell`, `Sales & Invoicing`, `UI Components`, `Master Data Management`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `requireTenantPrisma()` connect `Finance & Payments` to `Finance & Payments`, `Dashboard & Shell`, `Production Workflow`, `Master Data Management`, `Sales & Invoicing`, `Sales & Invoicing`, `Roasting Operations`, `Master Data Management`, `Master Data Management`, `Sales & Invoicing`, `Master Data Management`, `Master Data Management`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `formatRupiah()` connect `Finance & Payments` to `Finance & Payments`, `Finance & Payments`, `Dashboard & Shell`, `Production Workflow`, `Finance & Payments`, `Sales & Invoicing`, `Production Workflow`, `Finance & Payments`, `Finance & Payments`, `Finance & Payments`, `Finance & Payments`, `Sales & Invoicing`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `{ PrismaClient }`, `prisma`, `$schema` to the rest of the system?**
  _320 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Finance & Payments` be split into smaller, more focused modules?**
  _Cohesion score 0.051061388410786 - nodes in this community are weakly interconnected._
- **Should `Finance & Payments` be split into smaller, more focused modules?**
  _Cohesion score 0.06692242114236999 - nodes in this community are weakly interconnected._
- **Should `Project Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._