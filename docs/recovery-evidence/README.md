# Recovery evidence — encrypted dump

This directory contains the most recent successful restore-drill artifact. It is **encrypted** with AES-256-CBC + PBKDF2 (250k iterations) and a per-run passphrase. The plaintext `pg_dump` is never stored here.

## Files

| File | Purpose |
|---|---|
| `roastd-production.dump.enc` | AES-256-CBC encrypted logical backup of the `roastd.id` schema. |
| `roastd-production.dump.enc.sha256` | SHA-256 of the encrypted artifact; verify before any restore. |
| `catalogue.txt` | `pg_restore --list` output. Includes the canonical tables `tenants`, `invoices`, `inventory_ledger`. |
| `run.md` | Per-run drill summary (date, source, target, counts, exit codes). |

## Recovery procedure

1. Verify the artifact's SHA-256 matches the value in `<name>.sha256`:
   ```
   Get-FileHash roastd-production.dump.enc -Algorithm SHA256
   ```
2. Decrypt with the passphrase (read from a password manager — never commit):
   ```
   node scripts/backup/encrypt-backup.mjs --decrypt roastd-production.dump.enc roastd-production.dump "$PASSPHRASE"
   ```
3. Restore into a disposable PostgreSQL 17 target:
   ```
   pg_restore --exit-on-error --clean --if-exists --no-owner --no-privileges \
     --dbname=postgresql://... roastd-production.dump
   ```
4. Run the three canonical verification queries from the workflow:
   ```
   SELECT COUNT(*) FROM tenants;
   SELECT COUNT(*) FROM _prisma_migrations;
   SELECT COUNT(*) FROM inventory_ledger;
   ```
5. After verification, delete the plaintext dump. Retain the encrypted artifact for the configured retention window (default 30 days).

## .gitignore

This directory is **gitignored** at the repo root (`/docs/recovery-evidence/`). The encrypted artifact is the data; committing it would defeat the purpose of off-site, secret-protected storage.
