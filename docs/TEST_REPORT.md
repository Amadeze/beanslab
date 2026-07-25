# Test Report

Tanggal: 25 Juli 2026

## Baseline sebelum perbaikan

| Gate | Hasil |
| --- | --- |
| Lint | Gagal: mutation selama render pada `ProductionForm` |
| Unit | 158/160 lulus |
| Unit failure 1 | `createCreditNote` tanpa explicit role guard |
| Unit failure 2 | Loading inventory tanpa recognized accessible/loading marker |
| Production build | Lulus; 33 static pages dan dynamic routes terkompilasi |

## Perbaikan

- HPP summary sekarang direduksi sebagai immutable accumulator.
- `createCreditNote` memakai `requireRole("OWNER", "MANAGER", "CASHIER")`.
- Inventory loading memiliki `aria-busy` dan accessible label.
- Selector E2E keuangan mengikuti role aksesibel `tab`.
- Credential Artisan tidak lagi diserialisasi ke HTML pengaturan.
- Stack font storefront tidak lagi bergantung pada variabel CSS yang tidak tersedia.

## Final gate

| Gate | Hasil |
| --- | --- |
| Lint | Lulus |
| Typecheck | Lulus |
| Unit | 29 file, 160/160 lulus |
| Production build | Lulus; 36 static pages dan seluruh dynamic route terkompilasi |
| Smoke E2E | 6/6 lulus |
| Mobile overflow | 11/11 halaman dashboard lulus pada 390 × 844 |
| Storefront themes | 10/10 tema, katalog, cart, dan responsive check lulus |
| Browser QA landing | Desktop dan mobile lulus; tidak ada horizontal overflow |
| Dashboard operations workbench | Command rail, telemetry, persistent mobile quick actions, task queue, shift summary, status table, desktop + mobile lulus |
| Global app shell | Desktop spine, mobile dock, dan drawer navigation lulus |
| Core operating workspaces | 5/5 tahap, next-stage link, desktop, dan mobile overflow lulus |
| Product information architecture | Pasokan, Roastery, Penjualan, Katalog, Settings hub, role-aware directory, legacy redirects, dan sidebar grouping lulus |
| Kasir offline | Product grid, cart surface, mobile checkout drawer, dan overflow lulus |
| Material Intelligence surfaces | Auth desktop/mobile dan password recovery lulus |
| Landing command dossier | Live operating tableau, decision queue, material flow, desktop/mobile, dan overflow lulus |
| Landing motion choreography | Technical command tableau, shared stage signal, connection beam, scan line, decision pulse, ledger fill, pointer tilt, roast curve reveal, FAQ transition, dan reduced-motion fallback lulus |
| Auth motion choreography | Login/register frame reveal, ambient scan, headline reveal, form entrance, five-domain rail, desktop/mobile, dan reduced-motion fallback lulus |
| Superadmin control plane | Dashboard desktop dan tenant registry mobile lulus |
| Domain navigation | Pasokan, roasting, produksi, penjualan, dan finance memiliki active tone tersendiri |
| Print surfaces | Invoice dan nota memakai screen toolbar obsidian, copper document rule, dan print-safe white body |

Perintah agregat `pnpm test:e2e` sempat melewati batas waktu runner 184 detik. Seluruh spec kemudian dijalankan terpisah dan lulus. Ini adalah batas waktu orkestrasi, bukan kegagalan assertion.

## Manual QA lanjutan sebelum production

- Create/receive purchase dan ledger.
- Complete/void roast dan production.
- Create/pay/return invoice.
- Artisan pairing desktop aktual dan retry jaringan.
- Checkout Midtrans sandbox menggunakan credential deployment.
- Keyboard, mobile overflow, zoom 200%, dan screen reader pada dialog/table.
