# Security Review

## Executive summary

Tidak ditemukan risiko kritis terbuka dalam jalur yang diperiksa. Dua temuan High—guard role credit note dan serialisasi credential Artisan—telah diperbaiki. Kontrol tenant, session cookie, upload, webhook signature, idempotency, rate limit, audit, dan credential encryption sudah tersedia.

## Resolved findings

### SEC-001 — Credit note lacked explicit role authorization

- Rule: NEXT-AUTH-001 / NEXT-ACTION-001
- Severity: High
- Location: `src/app/(dashboard)/penjualan/actions.ts`, `createCreditNote`
- Evidence baseline: action memanggil tenant/session helper tetapi tidak `requireRole()`. Test `code-safety.test.ts` membuktikan kegagalan.
- Impact: user tenant dengan role yang tidak dimaksud dapat mencoba membuat retur bila action dapat dipanggil.
- Fix: guard `OWNER`, `MANAGER`, `CASHIER` ditambahkan sebelum membaca/mengubah data.
- Mitigation: tenant scope dan invoice ownership sudah membatasi blast radius, tetapi bukan pengganti authorization.

### SEC-004 — Artisan webhook token was serialized into settings HTML

- Rule: NEXT-DATA-001
- Severity: High
- Location: `src/app/(dashboard)/settings/page.tsx`
- Evidence baseline: seluruh record tenant, kecuali Midtrans server key, diteruskan ke Client Component sehingga token muncul dalam RSC payload.
- Impact: token dapat dibaca dari source HTML oleh setiap owner yang membuka halaman.
- Fix: `artisanWebhookToken` dikeluarkan dari payload server bersama `midtransServerKey`; smoke E2E menegaskan nama field dan ciphertext tidak ada di HTML.

## Open hardening items

### SEC-002 — Production CSP still allows inline script

- Rule: NEXT-CSP-001
- Severity: Medium
- Location: `next.config.ts:7-20`
- Evidence: production `script-src` mengandung `'unsafe-inline'`.
- Impact: mengurangi efektivitas CSP bila XSS sink ditemukan.
- Fix: migrasikan ke nonce CSP mengikuti Next.js 16; uji Midtrans dan hydration sebelum enforcement.
- False-positive note: policy dan security headers sudah aktif; ini hardening, bukan bukti exploit.

### SEC-003 — Development upload fallback is web-accessible

- Rule: NEXT-FILES-001
- Severity: Low (development only)
- Location: `src/lib/storage.ts:77-85`
- Evidence: fallback menulis image tervalidasi ke `public/uploads`.
- Impact: file development dapat diakses langsung.
- Existing controls: hanya JPEG/PNG/WebP, signature check, generated filename, size limit, role check, rate limit. Production fail-closed tanpa object storage.
- Recommendation: pertahankan hanya untuk local development; jangan mengaktifkan fallback ini pada production.

## Verified controls

- Session cookie: HttpOnly, SameSite Strict, Secure conditional, bounded 8 jam.
- Tenant isolation: Prisma extension menambahkan tenant filter dan menolak owned relation lintas tenant.
- Upload: authz, limit 5 MB, MIME allowlist, signature validation, random path.
- Midtrans: signature timing-safe comparison, amount match, idempotent event claim.
- Server errors: request ID dan sanitized client response.
- Password reset: hashed, expiring, single-use (berdasarkan implementation/test).

## Verification still required

- Runtime header scan pada production edge/CDN.
- Penetration test tenant IDOR dan cross-tenant export/search.
- Abuse/load test untuk checkout, auth, upload, webhook, dan cron.
- Secret scan pada git history dan rotation bila pernah terpapar.
