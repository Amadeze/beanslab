---
name: ros-design-system
description: Material Intelligence design system rules for roastd.id — tokens, domain colors, layout/motion/status contracts, primitive usage. Triggers on any UI/component/styling/page work.
license: Internal
---

# Material Intelligence — roastd.id Design System

Canonical source: `docs/DESIGN_SYSTEM.md`, `src/components/design-system/tokens`, `src/components/ui/*`

## Token Palette (semantic, not decorative)

| Token | Hex | Role |
|---|---|---|
| Obsidian | `#080B0C` | system spine, control surface, navigation |
| Soft obsidian | `#111617` | raised dark surface |
| Parchment canvas | `#ECEAE2` | application background |
| Parchment surface | `#F4F2EA` | form and content surface |
| Raised ivory | `#FFFDF8` | table, card, document |
| Copper | `#B65331` | primary action, roasting |
| Verdigris | `#2B7567` | inventory and supply |
| Brass | `#A66F12` | production and packaging |
| Plum | `#6F4A6A` | sales and customers |
| Moss | `#4B6B3C` | finance and cash |
| Instrument cyan | `#15B8C6` | live, connection, telemetry ONLY |
| Burgundy | `#8C2F39` | destructive and critical risk |

Typography: **Inter** (UI/editorial), **JetBrains Mono** (identifiers, telemetry, labels). Tabular numbers for metrics.

## Domain Identity (color always accompanied by icon/label/text)

| Domain | Token | Nav active | Hero signal |
|---|---|---|---|
| Pasokan & Stok | `domain-inventory` | Verdigris | Deep verdigris |
| Roasting | `domain-roasting` | Copper | Dark ember |
| Produksi & Packing | `domain-production` | Brass | Dark brass |
| Penjualan & Pesanan | `domain-sales` | Plum | Dark plum |
| Kas & Piutang | `domain-finance` | Moss | Dark moss |

## Layout Contracts

- Desktop: obsidian system spine + inset parchment workspace
- Mobile: compact workspace header, persistent 5-slot dock, drawer untuk seluruh menu, quick action dalam jangkauan ibu jari
- Dashboard: exception-first control room; satu hero keputusan, satu sinyal penting, alur bahan-ke-kas, queue, shift ledger, evidence
- Workspace: compact page header, stage rail, operating hero, metric strip, task tabs, lalu data surface
- Auth: obsidian editorial panel + parchment form; mobile = satu form surface
- Superadmin: obsidian platform navigation + light material data plane
- Print: white document dengan copper rule; toolbar obsidian hanya di layar
- Storefront tenant mempertahankan theming milik tenant

## Interaction & Navigation Contracts

- Satu layar = satu navigasi utama + satu navigasi lokal
- Mobile: maksimal 5 tujuan tingkat atas; sisanya drawer/pemilih konteks
- Jalur operasional mobile: hanya tampilkan tahap aktif + tahap berikutnya
- Satu layar = satu primary action; secondary = outline/ghost; destructive dipisahkan
- Target sentuh minimum 44×44px; teks bermakna minimum 12px desktop / 14px mobile
- Breadcrumb hanya hierarki ≥3 tingkat
- Status = label + ikon + warna (warna tidak boleh satu-satunya sinyal)

## Typography & Density

- Headline operasional max ~`3rem` workspace/dashboard
- Headline auth/marketing max ~`3.6rem` desktop panel
- Metric pakai tabular numbers
- Label teknis: mono uppercase 8–10px, tracking lebar
- Radius kecil untuk kontrol; data surface cenderung persegi/technical, bukan kartu pil

## Motion Choreography

- Landing = **Technical Command Dossier** art direction
- Hero = dua kolom: editorial kiri + live operating tableau kanan
- Signature interaction di dalam instrumen: active-stage signal bergerak 5 tahap, connection beam, scan line, decision alert, shift ledger
- Live operating tableau: spring tilt sangat kecil, shared stage indicator, status pulse, decision queue, animated ledger fill
- Material journey: vertical signal line + staged reveal (pasokan → kas)
- Login/register: frame reveal, ambient scan, clipped headline reveal, staggered form surface, animated five-domain rail
- Scroll reveal: opacity, scale sangat kecil, pergeseran pendek max ~680ms; hindari blur banyak node
- Kurva roast digambar saat visual Artisan masuk viewport + telemetry scanner
- FAQ: animated height; pricing/feature hanya gerak saat hover/focus
- Scroll progress: orientasi + anchor, native smooth scroll
- **Tidak pakai** scroll hijacking, cursor takeover, bouncing, particle background berat
- **Wajib** versi static saat `prefers-reduced-motion: reduce`

## Core Primitives (pakai & kembangkan yang ada)

Button, Badge, Input, Select, Dialog, Sheet, Tabs, Table, Tooltip, Command, EmptyState, LoadingState, PageHeader, OperatingHero, WorkspaceNav, SectionHeader, KpiCards

Primary Button = Copper; domain action boleh pakai token domain (terima stok = verdigris, catat pembayaran = moss)

## Status Language (wajib label teks + contrast)

- Inventory: normal, low stock, out of stock, incoming
- Operation: draft/pending, completed, void
- Invoice: draft, issued, partial, paid, void, returned
- Integration: online, offline, revoked; import uploaded/parsing/imported/duplicate/failed

---

**Ketika mengerjakan UI:** selalu rujuk token di atas; jangan impor warna hardcoded; pakai primitive yang ada; hormati kontrak motion & reduced-motion.