# Documentation Index — roastd.id

> This folder previously accumulated parallel audits and dated working notes. As of the cleanup on 2026-08-31, stale reports are archived under `archive/2026-07-29/` and the current authoritative documents are kept at the top of `docs/`.

## Authoritative (current)

| File | Purpose |
|---|---|
| `HANDOFF.md` | Release status, gate evidence, open blockers, "do not" list. Update on every release. |
| `DATABASE_RECOVERY.md` | Backup/restore runbook, GH Actions secret checklist, restore-drill evidence. |
| `DATABASE_MAP.md` | Domain model reference for the Prisma schema. |
| `ROUTE_MAP.md` | App Router route inventory. |
| `DESIGN_SYSTEM.md` | Tokens, theme, accessibility baseline. |
| `DESIGN_GUIDE.md` | Implementation-facing design guidance. |
| `SECURITY_REVIEW.md` | Live security findings and resolved items. |
| `TEST_REPORT.md` | Test coverage and recent run results. |
| `USER_WORKFLOWS.md` | End-to-end user journey documentation. |
| `IMPROVEMENT_ROADMAP_2026.md` | Forward-looking product/engineering roadmap. |

## Archive (`archive/2026-07-29/`)

Point-in-time audits and superseded working notes. Kept for traceability only — do **not** read these for current status. The most current "is it done?" answer always lives in `HANDOFF.md`.

- `FULL_FEATURE_AUDIT_2026-07-29.md` — P0/P1/P2 audit from the 2026-07-29 review. Status of each item is reflected in `HANDOFF.md` and `IMPROVEMENT_ROADMAP_2026.md`.
- `PRODUCT_AUDIT.md` — superseded by `ROUTE_MAP.md` + `DESIGN_SYSTEM.md`.
- `ROADMAP.md`, `REDESIGN_PLAN.md` — superseded by `IMPROVEMENT_ROADMAP_2026.md`.
- `MIGRATION_NOTES.md`, `migration-history-recovery.md` — superseded by `DATABASE_RECOVERY.md`.
- `COMPETITIVE_LANDSCAPE_2026.md` — research artefact, not policy.
- `PAYMENT_OPERATIONS_ID.md`, `PRODUCTION_INTEGRATIONS_ID.md`, `artisan-integration.md` — integration design notes referenced from README.
- `FEATURE_INVENTORY.md` — superseded by `ROUTE_MAP.md` + `IMPROVEMENT_ROADMAP_2026.md`.
- `UX_AUDIT.md` — superseded by `DESIGN_SYSTEM.md` + `USER_WORKFLOWS.md`.
