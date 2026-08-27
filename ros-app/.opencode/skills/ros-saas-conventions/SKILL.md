---
name: ros-saas-conventions
description: Multi-tenant SaaS conventions for roastd.id — tenant isolation guardrails, server-side RBAC, subscription/cron ops, security conventions. Triggers on auth, roles, tenant data access, billing/subscriptions, cron, security-sensitive changes.
license: Internal
---

# SaaS Conventions — roastd.id

Canonical sources: `README.md` (Security, Database Rules, Webhooks, Operational Endpoints), `src/lib/tenant-*.ts`, `src/lib/subscription*.ts`, `src/middleware.ts`, migration 006, `scripts/production-preflight.mts`

## Tenant Isolation (guardrails wajib)

- **Selalu gunakan `requireTenantPrisma()`** untuk akses DB dashboard — tidak boleh `prisma` raw
- Prisma tenant extension **menolak cross-tenant FK** secara otomatis
- **RLS aktif** (migration 006) — revoke Data API privileges dari `PUBLIC`, `anon`, `authenticated`
- Server actions **enforce role permissions independen dari UI** — jangan percaya client-side checks
- Business codes unique per tenant (enforced di DB)

## Authentication & Security

- Session cookies: `iron-session`; production **wajib `SESSION_SECRET`**
- Midtrans tenant server keys: **AES-256-GCM encrypted** dengan `CREDENTIAL_ENCRYPTION_KEY` dedicated
- **Rate limit** surfaces: login, register, uploads, billing, public checkout
- Password reset tokens: hashed, expire 30 menit, single-use
- **Jangan pernah serialize server keys / Artisan tokens ke client payload**
- Storefront & settings payloads: strip server keys sebelum kirim ke browser

## Role-Based Access (server-side)

Roles: OWNER (full + billing + danger zone), MANAGER (manage members, integrations, all features), CASHIER (POS/kasir), OPERATOR (6 nav items), VIEWER (read-only)
- Permission resolution di server action, bukan UI
- Navigation gated via `canAccessNavigation(role)` di `src/components/layout/Sidebar.tsx`
- Onboarding: exactly **1 mandatory step** (bank/QRIS), 2 optional, enforced via redirect sampai `setupCompletedAt`
- Billing wall redirect ke `/billing` saat `SUBSCRIPTION_REQUIRED`

## Cron & Subscription Ops (wajib konfig production)

| Cron | Schedule | Auth | Fungsi |
|---|---|---|---|
| `POST /api/cron/subscriptions` | Daily | `CRON_SECRET` | Expire trial → `EXPIRED`; paid past due → `PAST_DUE` |
| `POST /api/cron/overdue-reminders` | Daily | `CRON_SECRET` | Kirim reminder per channel/UTC day (Email=Resend, WA=Fonnte) |
| `POST /api/cron/payment-submissions` | Hourly | `CRON_SECRET` | Expire unpaid storefront order → void invoice → reverse journal → return reserved stock |

- GitHub workflow `ROS Daily Operations` butuh `PRODUCTION_APP_URL` + `PRODUCTION_CRON_SECRET` secrets
- Maintenance: `pnpm maintenance:cleanup`, `pnpm maintenance:subscriptions`

## Webhooks (tenant-scoped, idempotent)

- `/api/webhooks/artisan` — `Authorization: Bearer <artisan token>` (legacy `?token=` supported)
- `/api/webhooks/tenant-midtrans` — per tenant Midtrans config
- `/api/webhooks/superadmin-midtrans` — platform Midtrans
- Artisan event >1 batch pending → payload **wajib `parent_batch_id`**

## Verification Gates (pre-release)

```bash
pnpm typecheck
pnpm lint --quiet
pnpm test
pnpm build
pnpm audit --prod
pnpm audit:stock
pnpm audit:integrity
pnpm audit:tenant-isolation
pnpm preflight:production
```

## HANDOFF "Do Not" List (wajib dihormati)

- Jangan sentuh `information_architecture_audit.md`
- Jangan modifikasi migrations 000–004
- Jangan push tanpa otorisasi eksplisit
- Jangan pakai test-only local storage root / E2E provider secret sebagai config production

---

**Ketika mengerjakan auth/tenant/billing/cron/security:** validasi lewat `requireTenantPrisma()`; role check di server action; idempotency key di webhook; jalankan preflight sebelum deploy.