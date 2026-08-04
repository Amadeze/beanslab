<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Client identity & rate limiting (safety)

- Forwarded headers (`X-Forwarded-For`, `X-Real-IP`) are NEVER trusted implicitly —
  a client can spoof them to reset rate-limit buckets. Trust is granted only by
  `src/lib/client-identity.ts`:
  - Vercel: `process.env.VERCEL === "1"` (platform-set, cannot be forged). The edge
    proxy owns the source connection; first chain entry is the client.
  - Self-hosted: only with explicit `TRUST_PROXY=1` + `TRUSTED_PROXY_HOPS=<n>`
    (default 1). Required deployment conditions: app port not reachable from the
    internet; proxy strips client-supplied forwarded headers; proxy rewrites headers
    from the source connection; known fixed hop count.
- Without a trusted identity the network layer is SKIPPED (never a random per-request
  identifier, never a global "unknown"/"untrusted" bucket) — buckets are built from
  account/tenant/resource identifiers instead.
- `enforceRateLimit` takes `identifiers: string[]` (layered buckets, each enforced
  independently). Never pass raw PII/tokens/subdomains into identifiers or logs;
  use the builders from `src/lib/client-identity.ts`.

# Prisma CLI & database targets (safety)

- `prisma.config.ts` reads `.env.local` (dotenv) and can override shell environment:
  URL resolution is `DIRECT_URL` first, then `DATABASE_URL` — a shell override of
  `DATABASE_URL` alone is ignored when `.env.local` sets `DIRECT_URL`. `.env.local`
  normally points at the PRODUCTION Supabase database.
- NEVER run `prisma migrate dev/deploy/reset`, `db push`, or raw SQL against
  production. Use the guarded scripts instead: `pnpm prisma:migrate:deploy`,
  `pnpm prisma:migrate:dev`, `pnpm prisma:migrate:reset`, `pnpm prisma:db:push` —
  each fails unless the resolved target host is local
  (localhost/127.0.0.1/host.docker.internal/*.local) or `ALLOW_REMOTE_MIGRATIONS=true`
  is set explicitly.
- Integration tests: `RUN_INTEGRATION=true` + `TEST_DATABASE_URL` (local only, resolved by
  `test/setup/test-database-guard.ts`). `DATABASE_URL`/`DIRECT_URL` are never used as a
  fallback; tests fail fast on Supabase/non-local hosts.
- On this machine the Prisma CLI cannot connect to local URLs directly ("string contains
  embedded null"); apply schema to the local test DB via
  `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` + psql
  (`C:\Program Files\PostgreSQL\18\bin\psql.exe`, PG18 port 5432, user/db `ros_test`).
