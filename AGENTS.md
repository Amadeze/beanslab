<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
