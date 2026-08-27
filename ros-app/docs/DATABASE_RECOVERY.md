# Database Recovery — Free-Plan Runbook

This runbook closes the recovery gap without requiring Supabase managed backups. It provides a daily encrypted logical dump, an automated restore drill into disposable PostgreSQL, and a private GitHub Actions artifact with 30-day retention.

## Required GitHub Actions secrets

- `BACKUP_DATABASE_URL`: a direct, SSL-enabled, least-privilege PostgreSQL URL that can read the production database. Use a dedicated backup role where supported. Never use a publishable Supabase key.
- `BACKUP_ENCRYPTION_PASSPHRASE`: a unique random passphrase of at least 24 characters. Store a second copy in the owner's password manager; losing it makes every backup unrecoverable.

The workflow is `.github/workflows/database-backup.yml`. A missing or weak secret fails visibly; it never reports success while silently skipping backup.

## Daily evidence

Every successful run proves all of the following:

1. PostgreSQL can produce a non-empty custom-format dump.
2. The dump catalogue contains `tenants`, `invoices`, and `inventory_ledger`.
3. The dump restores with `--exit-on-error` into a disposable PostgreSQL 17 database.
4. The restored target can read tenants, Prisma migration history, and the canonical inventory ledger.
5. Only the AES-256 encrypted dump, checksum, and non-data catalogue are uploaded.

Target recovery objectives for the initial launch:

- RPO: at most 24 hours.
- RTO: at most 60 minutes after an owner can access the artifact and passphrase.
- Retention: 30 daily restore-verified artifacts.

## Manual recovery drill

Never restore into a production URL during a drill.

1. Download the newest successful `roastd-production-backup-*` artifact.
2. Verify `sha256sum -c roastd-production.dump.enc.sha256`.
3. Decrypt locally with the passphrase:

   ```sh
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 \
     -in roastd-production.dump.enc \
     -out roastd-production.dump \
     -pass env:BACKUP_ENCRYPTION_PASSPHRASE
   ```

4. Create a new disposable PostgreSQL database.
5. Restore with:

   ```sh
   pg_restore --exit-on-error --clean --if-exists --no-owner --no-privileges \
     --dbname="$DISPOSABLE_RESTORE_DATABASE_URL" roastd-production.dump
   ```

6. Run tenant-isolation, stock, and integrity audits against the disposable target.
7. Delete the decrypted dump after the drill and retain the encrypted artifact.

## Production incident recovery

Production recovery requires an explicit owner decision. Provision a fresh database, restore the newest verified dump, run migrations in status-only mode first, run integrity audits, update Vercel database variables, deploy a preview, and execute health plus golden-path checks before promoting it. Do not overwrite the damaged database; preserve it for incident analysis.
