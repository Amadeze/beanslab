import dotenv from "dotenv";

// IMPORTANT — .env.local can override shell environment.
// dotenv loads .env.local into process.env WITHOUT overriding variables that
// already exist. The datasource URL below therefore resolves in this order:
//   1. shell/process DIRECT_URL
//   2. .env.local DIRECT_URL  (this repo's default — production)
//   3. shell/process DATABASE_URL
//   4. .env.local DATABASE_URL (production)
// Consequence: overriding DATABASE_URL in the shell alone does NOT redirect
// the Prisma CLI, because .env.local's DIRECT_URL wins. Only DIRECT_URL (or
// editing .env.local) changes the target. Destructive commands must go
// through the guarded scripts: `pnpm prisma:migrate:*` /
// `pnpm prisma:db:push` (see scripts/guard-prisma-target.mjs).
dotenv.config({
  path: ".env.local",
});

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});