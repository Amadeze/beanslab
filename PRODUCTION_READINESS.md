# Production Readiness Runbook

## Release gate

Run these commands against the release commit and the target environment:

```bash
pnpm install --frozen-lockfile
pnpm prisma:migrate:deploy
pnpm preflight:production
pnpm audit:tenant-isolation
pnpm audit:stock
pnpm audit:integrity
pnpm typecheck
pnpm lint -- --quiet
pnpm test
pnpm build
```

Do not deploy when preflight, migrations, tenant isolation, stock integrity, tests, or build fail. Lint warnings are technical debt; lint errors are release blockers.

Before approving the application release candidate, also run `pnpm test:e2e:release`
against an explicitly local, migrated, and seeded E2E database. The release runner
uses an isolated production server and refuses to reuse an unrelated server already
listening on its port. Override `PLAYWRIGHT_PORT` only when the default `3100` is busy.

## Current release snapshot (2026-08-22)

The application release candidate passes the complete local gate on an isolated PostgreSQL 18 target: all six migrations deploy from empty, schema diff is empty, tenant/stock/integrity audits pass, 1,345 integration-enabled tests pass, all 31 production-server Playwright tests pass through the isolated release runner, and the 68-page production build passes.

The branch is still **not approved for production deployment** because the intended environment has not passed preflight: the configured private Supabase bucket cannot be verified, required provider sandbox credentials are absent, and migrations 003–005 plus backup/restore evidence have not been verified on the target database. Local application readiness must not be confused with target-environment readiness.

The repository-local `.env.local` currently contains the documented example endpoints rather than target credentials. Preflight rejects these placeholders before making network or database checks. Run target preflight only from the deployment environment or an approved secret-injected release job.

The production dependency audit reports one high-severity transitive advisory in Prisma's trusted configuration path (`deepmerge-ts`). Prisma 7.9.1 is the latest available parent release and does not expose recursive user input to this merger in this application. Record explicit release risk acceptance and upgrade when Prisma ships the patched major. ExcelJS's `uuid` dependency is pinned to compatible patched version 11.1.1; its XLSX parser/export regression tests pass.

## Required configuration

Copy `.env.local.example` into the secret manager for the hosting platform. Generate `SESSION_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, and `CRON_SECRET` independently with a cryptographically secure generator. Never commit their real values.

`CREDENTIAL_ENCRYPTION_KEY` must match the key used to encrypt existing tenant credentials. If it must be rotated, set `OLD_CREDENTIAL_ENCRYPTION_KEY` temporarily and run:

```bash
pnpm security:rotate-credential-key
pnpm preflight:production
```

Remove the old key after the decrypt check passes.

Panduan setup provider dan code signing tersedia di `docs/PRODUCTION_INTEGRATIONS_ID.md`.

## Database deploy and rollback

1. Put the application in a maintenance window for schema-changing releases.
2. Take a provider snapshot and a logical backup using the direct (non-pooler) URL:

   ```bash
   pg_dump --format=custom --no-owner --no-acl "$DIRECT_URL" > ros-before-release.dump
   ```

3. Run `pnpm prisma:migrate:deploy` once from a release job, before starting new application instances.
4. Run `pnpm preflight:production`, then deploy the application.
5. Verify `/api/health/live` and `/api/health` return HTTP 200.

Application rollback means redeploying the previous image. Do not manually edit `_prisma_migrations`. If a schema rollback is required, restore the verified snapshot into a new database and switch traffic after validation.

## Scheduled jobs

Call these endpoints with `Authorization: Bearer $CRON_SECRET` at least daily:

- `/api/cron/subscriptions`
- `/api/cron/overdue-reminders`
- `/api/cron/daily-brief`
- `/api/cron/payment-submissions` (hourly; releases reserved stock for expired storefront orders)

The readiness endpoint reports each job as `fresh`, `stale`, `failed`, or `not_observed`. Alert on HTTP 503, failed jobs, or jobs stale for more than 36 hours.

## Smoke test after deploy

Use a dedicated pilot tenant and verify this exact chain:

1. Receive a green-bean purchase with supplier lot and expiry.
2. Complete roasting and confirm a roasted-bean output lot exists.
3. Produce finished goods and confirm RB and packaging were consumed by FEFO.
4. Configure a tenant bank account or QRIS, place a storefront order, upload proof, verify it, and confirm stock, journal, receivable, and cash agree.
5. Trace the finished-goods lot back to purchase and forward to the customer.
6. Void a disposable test transaction and confirm stock and journal reversal entries appear.
7. Test overdue notification preferences and one real email/WhatsApp delivery.

## Backup and recovery policy

- Enable provider point-in-time recovery for the production database.
- Keep daily backups for at least 30 days and monthly backups for 12 months.
- Run a restore drill into an isolated project at least quarterly.
- Recovery is accepted only after `preflight:production`, `audit:stock`, and `audit:integrity` pass on the restored database.

## Go/no-go

Go only when the preflight result is `ready: true`, all migrations are applied, integrations required by the selected plan are configured, a backup is verified, and the pilot workflow passes. Missing email or WhatsApp credentials may be accepted only if those channels are explicitly disabled for launch; missing core secrets or object storage is a no-go.
