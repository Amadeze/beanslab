# roastd.id

roastd.id adalah platform operasional multi-tenant untuk coffee roastery. Cakupannya menghubungkan inventory ledger, purchasing, roasting, production, sales, payments, financial reporting, tenant storefronts, subscription billing, serta webhook hardware dan pembayaran.

## Requirements

- Node.js 24.17.x
- pnpm 11.9.0
- PostgreSQL
- Chromium for Playwright E2E tests

## Local Setup

```bash
pnpm install
cp .env.local.example .env.local
pnpm prisma generate
pnpm prisma migrate deploy
pnpm dev
```

Open `http://localhost:3000`.

## Verification

```bash
pnpm typecheck
pnpm lint --quiet
pnpm test
pnpm test:e2e
pnpm build
pnpm audit --prod
pnpm audit:stock
pnpm audit:integrity
pnpm audit:tenant-isolation
pnpm preflight:production
```

`pnpm verify` runs the core non-E2E release gate.

## Database Rules

- `InventoryLedger` is the source of truth for stock.
- Product and packaging stock columns are transactional caches.
- Business codes are unique per tenant.
- All dashboard database access must use `requireTenantPrisma()`.
- Cross-tenant foreign keys are rejected by the Prisma tenant extension.
- Corrections use reversal entries or explicit VOID workflows.
- Never edit an applied migration. Create a new migration for every schema change.

## Migration Workflow

```bash
pnpm prisma migrate status
pnpm prisma migrate dev --name descriptive_change
pnpm prisma migrate deploy
```

Production deployment must run `prisma migrate deploy` before starting the new application version. Verify afterward with:

```bash
pnpm prisma migrate status
pnpm preflight:production
pnpm audit:integrity
pnpm audit:stock
```

## Security

- Session cookies use `iron-session`; production requires `SESSION_SECRET`.
- Midtrans tenant server keys are encrypted with AES-256-GCM.
- Use a dedicated `CREDENTIAL_ENCRYPTION_KEY` in production.
- Login, registration, uploads, billing, and public checkout are rate-limited.
- Server actions enforce role permissions independently of the UI.
- Storefront and settings payloads never serialize server keys or Artisan tokens.
- Password reset tokens are hashed, expire after 30 minutes, and are single-use.

To encrypt legacy plaintext credentials:

```bash
pnpm security:encrypt-credentials
```

If credentials were originally encrypted with `SESSION_SECRET`, set a new
`CREDENTIAL_ENCRYPTION_KEY` and rotate them before deployment:

```bash
pnpm security:rotate-credential-key
```

For a later dedicated-key rotation, temporarily set
`OLD_CREDENTIAL_ENCRYPTION_KEY` to the previous key. The rotation validates
every ciphertext before applying updates in one database transaction.

## Operational Endpoints

- `GET /api/health` checks database and required production configuration.
- `GET /api/health/live` is the process liveness probe.
- `/audit` shows tenant audit events and webhook processing state.

Periodic maintenance:

```bash
pnpm maintenance:cleanup
pnpm maintenance:subscriptions
```

Configure the deployment scheduler to call `POST /api/cron/subscriptions` at
least daily with `Authorization: Bearer <CRON_SECRET>`. It marks expired trials
as `EXPIRED` and paid subscriptions past their billing date as `PAST_DUE`.

Call `POST /api/cron/overdue-reminders` daily with the same authorization.
Each overdue invoice is sent at most once per channel per UTC day. Email uses
Resend, while WhatsApp uses `WA_API_URL` with a Fonnte-compatible API.

Call `POST /api/cron/payment-submissions` hourly. It expires unpaid storefront
orders, voids their invoice, reverses journals, and returns reserved stock.

The included `ROS Daily Operations` GitHub workflow performs readiness,
subscription, and reminder calls after `PRODUCTION_APP_URL` and
`PRODUCTION_CRON_SECRET` are configured as repository secrets.

## Storage

Production uploads require Supabase Storage:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_PRIVATE_STORAGE_BUCKET` (private bucket for customer payment proofs and raw Artisan `.alog` files)

Local development stores public assets under `public/uploads/<tenantId>` and
private proofs under ignored `.data/private-uploads`. Production deliberately
fails when object storage is not configured.

## Read-only Load Smoke

After deploying migrations and warming the application, run a repeatable GET-only
load smoke against readiness or an authenticated dashboard route:

```bash
LOAD_TEST_URL="https://app.roastd.id" \
LOAD_TEST_PATH="/api/health" \
LOAD_TEST_REQUESTS="500" \
LOAD_TEST_CONCURRENCY="25" \
pnpm load:smoke
```

For authenticated routes, provide `LOAD_TEST_COOKIE` from a dedicated test account.
The command fails when the default threshold is exceeded: p95 above 1.5 seconds or
an error rate above 1%. It only sends `GET` requests and is safe from transaction writes.

Tenant storefront payments can use the roastery's own bank account or QRIS.
Customers upload proof to private storage; an OWNER, MANAGER, or CASHIER must
verify it under **Penjualan → Bukti bayar** before a `Payment` and cash journal
are created. Configure destinations under **Pengaturan → Pembayaran Portal**.

## Inventory Ledger

The Inventory page exposes the latest 500 tenant-scoped mutations with search,
IN/OUT filters, pagination, operator attribution, and filtered PDF/Excel
exports. Cached stock remains transactionally synchronized with the immutable
ledger and can be checked with `pnpm audit:stock`.

Purchases support cash, partial, and credit terms. Supplier payments are
immutable records with VOID correction, payable aging, and Balance Sheet
integration.

## Roastery Workflows

- Lots connect supplier and purchase receipts to batch codes, expiry dates,
  inventory mutations, and downstream traceability.
- Roasting batches connect green-bean inputs, Artisan telemetry, yield, HPP,
  finished goods, and cupping sessions.
- Cupping scores are unique per session/category and constrained to valid score
  ranges at the database layer.
- B2B contracts are tenant/customer scoped and can define product-specific MOQ
  tiers, per-kg prices, or per-unit prices.
- Sales, payments, stock mutations, contract changes, and corrective workflows
  write tenant-scoped audit records.

## Webhooks

- `/api/webhooks/artisan` with `Authorization: Bearer <artisan token>`
- `/api/webhooks/tenant-midtrans`
- `/api/webhooks/superadmin-midtrans`

Artisan events are stored in the webhook inbox. When more than one roasting batch is pending, the payload must include `parent_batch_id`.
The legacy `?token=` query parameter remains supported for existing Artisan
setups, but the authorization header avoids exposing tokens in access logs.

## Reporting and Scheduled Operations

- Financial reports use the tenant timezone configured in Settings and exclusive calendar-period boundaries.
- Inventory valuation is reconstructed from the immutable ledger as of the report timestamp using weighted-average cost.
- The daily operations workflow records durable `JobRun` history for subscription maintenance, overdue reminders, and Morning Brief generation.
- Morning Brief snapshots are generated once per tenant/report date and shown on the dashboard with sales, cash, roasting, production, aging, inventory, and integration exceptions.
- `/api/health` exposes job freshness without preventing a stale job from running its own recovery schedule.

Before enabling the new reporting jobs, deploy the database migration and configure `PRODUCTION_APP_URL` and `PRODUCTION_CRON_SECRET` in the repository workflow secrets.

## Recovery and Maintenance

- Use managed PostgreSQL point-in-time recovery where available.
- Take a provider snapshot before migrations that rewrite data.
- Run restore drills against a separate database.
- Never test restore procedures against the production database.
- Run `repair:tenant-relations` without `--apply` first. Apply only after reviewing the generated repair plan:

```bash
pnpm repair:tenant-relations
pnpm repair:tenant-relations -- --apply
pnpm repair:hpp-cache
pnpm repair:hpp-cache -- --apply
```

Both repair commands are dry-run by default. Review the proposed records before
using `--apply`, then rerun `pnpm audit:integrity` and `pnpm audit:stock`.

## Release Checklist

1. Database backup or provider snapshot confirmed.
2. `pnpm install --frozen-lockfile` succeeds.
3. Migration status is clean.
4. Typecheck, lint, unit tests, E2E, and build pass.
5. Stock and integrity audits report no violations.
6. Health endpoint returns HTTP 200 after deployment.
7. Payment and Artisan webhook smoke tests pass.
