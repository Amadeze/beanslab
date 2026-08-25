# DESIGN_GUIDE — roastd.id Roastery OS

A single, elegant design system for the whole roastery platform: **light editorial-minimal
canvas + retained dark workbench** (sidebar/header), refined copper accent, and the
"Material Intelligence" instrument craft (mono labels, faint grid). Every surface, component,
and page follows this guide so the product reads as one coherent product.

---

## 1. Philosophy

- **One product, one language.** Color, type, spacing, radius, and motion are shared everywhere.
- **Light canvas, dark anchor.** Content lives on a calm warm-paper canvas; the sidebar and
  page-header bar stay obsidian to anchor navigation and give the "workbench" feel.
- **Restraint = elegance.** Monochrome ink + a *single* copper accent. No competing colors.
- **Calm, not flat.** Hairline borders, soft shadows, considered micro-interactions.
- **Connected, not cluttered.** Navigation follows the roastery chain; cross-links tie modules.

### Elegance principles (non-negotiable)
1. **Restraint** — one accent, no decorative noise.
2. **Rhythm** — strict 4pt spacing grid; one clear focal point per screen.
3. **Typographic craft** — confident display sizes, comfortable body leading, mono eyebrows.
4. **Quiet tactility** — hairline borders, soft shadow, weighted hover/focus.
5. **Calm motion** — short, purposeful easings; honor `prefers-reduced-motion`.
6. **Coherence** — every surface shares the same tokens.
7. **No clutter** — empty/error/loading states are designed, never afterthoughts.

---

## 2. Tokens (single source: `src/app/globals.css`)

### Color roles
| Token | Value | Use |
|---|---|---|
| `--paper` / `--app-bg` / `--canvas` | `#F7F5F1` | Page background (warm off-white) |
| `--surface` / `--card` | `#FFFFFF` | Cards, panels |
| `--paper-sunken` / `--surface-sunken` | `#F1EEE8` | Recessed areas, insets |
| `--surface-inverse` / `--sidebar` | `#05090D` | Dark workbench (sidebar, header bar) |
| `--ink` | `#1B1815` | Primary text on light |
| `--ink-secondary` | `#5C564E` | Secondary text |
| `--ink-tertiary` | `#8A8378` | Tertiary / hints |
| `--copper` / `--primary` | `#A94728` | **Primary accent** — actions, active, links |
| `--copper-strong` | `#8C3A1E` | Hover/active copper |
| `--copper-soft` | `#F3DCD1` | Copper tints, soft fills |
| `--instrument` | `#15B8C6` | **Sparse data/active signal** (use sparingly) |
| `--instrument-strong` | `#0E7C8A` | Instrument on light bg |
| `--border` | `#E7E2D9` | Hairline borders |
| `--border-strong` | `#D8D2C6` | Emphasized borders |
| Semantic | success `#2B7567`, warning `#8A5B0A`, danger `#8C2F39`, info `#176B87` | Status only |
| Domain | inventory `#2B7567`, roasting `#B65331`, production `#A66F12`, sales `#6F4A6A`, finance `#4B6B3C` | Module affordances |

Tailwind utilities map to these: `bg-paper`, `bg-card`, `text-ink`, `text-ink-secondary`,
`border-border`, `border-border-strong`, `bg-copper`, `text-copper`, `bg-instrument`,
`bg-surface-sunken`, `rounded-card` (12px), `shadow-elevation-soft`, `shadow-elevation-card`.

> **Drift is a bug.** Never hardcode hex in components. The deprecated parallel palette
> (`src/components/design-system/tokens/colors.ts`) is being retired; use CSS tokens.

### Typography
Fonts: **Space Grotesk** (display/heading), **DM Sans** (body), **JetBrains Mono** (data/labels).
Scale (modular, tight display tracking):

| Role | Size | Weight | Tracking | Line-height |
|---|---|---|---|---|
| Display | 48 / 3rem | 800 | `-0.04em` | 1.05 |
| H1 | 32 / 2rem | 800 | `-0.035em` | 1.1 |
| H2 | 24 / 1.5rem | 700 | `-0.02em` | 1.2 |
| H3 | 20 / 1.25rem | 700 | `-0.01em` | 1.25 |
| Body | 16 / 1rem | 400 | normal | 1.6 |
| Small | 14 / 0.875rem | 400 | normal | 1.5 |
| Caption | 12 / 0.75rem | 500 | normal | 1.4 |
| Eyebrow | 11 / 0.6875rem | 700 | `0.14em` (mono, uppercase) | — |

### Spacing (4pt base)
`--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 24 ·
`--space-6` 32 · `--space-8` 48. Page padding: 24–32; section gap: 24; card padding: 16–20.

### Radius & elevation
- Radius: sm 8 · base/`rounded-card` 12 · lg 16 · pill for chips.
- Elevation: `--elevation-soft` `0 1px 2px rgba(27,24,21,.04)` (default) ·
  `--elevation-card` soft + `0 8px 24px -16px rgba(27,24,21,.18)` (raised on hover only).

---

## 3. Component contract

Build every UI from these shared components (`src/components/ui`, `src/components/layout`).
Do **not** hand-roll cards/buttons/headers.

- **`Card` / `Panel`** — `bg-card border border-border rounded-card shadow-elevation-soft`.
  Variants: `raised` (hover elevation), `sunken` (`bg-surface-sunken`), `ghost` (no border).
- **`Button`** — copper primary; `outline`/`secondary`/`ghost`/`danger`. Radius `rounded-card`.
  Height 44px (`h-11`). Focus ring = `--instrument`. On dark chrome use light/instrument variants.
- **`Eyebrow`** — mono uppercase 11px, `--ink-tertiary` or copper. The signature label.
- **`PageHeader`** — dark obsidian bar (retained): eyebrow + title + description + actions;
  optional metrics row; optional breadcrumbs. Absorbs the old `CompactHeader`.
- **`Field` / `Input` / `Select` / `Textarea`** — 44px, `border-border`, focus `border-copper`
  + instrument ring. Labels use `Eyebrow`.
- **`Table`** — `bg-card`, hairline rows, sticky header, hover `bg-paper-sunken`, `min-w` + `overflow-x-auto`.
- **`Stat` / `KpiCard`** — light card: big number (display), eyebrow label, optional delta.
- **State kit** — `EmptyState`, `LoadingState` (spinner), `Skeleton` (pulse), `ErrorState`.
  Every list/table has all three. No bare "Loading…" text.
- **`Badge` / `Chip` / `Tooltip`** — chip radius pill; semantic colors only.
- **`Dialog` / `Drawer`** — light surface, hairline border, backdrop blur.

---

## 4. Information architecture

Navigation follows the **roastery value chain**. One nav source (no duplicate tab walls).

- **Hari Ini** (merged hub) → Pasokan → Roasting → Kualitas → Produksi → Gudang →
  Penjualan → Keuangan → Intelligence → Setelan.
- **Hari Ini** = personal/role briefing + AI Copilot insights (top) **+** Control-Tower
  execution sections (produce / roast / buy / fulfill / readiness / warehouse) below.
- **Surface every route.** No route reachable only via a second tab bar.
- **⌘K command palette** — global, searchable (menus you can't see are searchable).
- **Breadcrumbs** on every inner page.
- **Report Center** — collapsible, grouped (5 groups, not a 24-tab wall).

### Cross-link contract (every module connects)
LOT → "Roast this lot" · Batch → "Cup this roast" · Cupping → clickable lot/batch ·
Produksi → back to Roasting · Penjualan → Produksi/fulfillment · Fulfillment → Gudang ·
Gudang → FEFO-by-lot. Every detail page shows a **next step** CTA + **back-link**.

---

## 5. Motion

- Default transitions `cubic-bezier(0.16,1,0.3,1)`, ≤ 200ms.
- Entrance: subtle fade-up only for above-the-fold hero/sections, once.
- Honor `prefers-reduced-motion`: disable transforms/animations.
- No gratuitous spinners/confetti.

---

## 6. Adding a page (template)

```tsx
<PageHeader eyebrow="Roasting" title="Batch #123" description="…" actions={…} />
<nav className="mb-4"> {/* breadcrumbs */}</nav>
<section className="space-y-6">
  <Card>…</Card>
  <Card>…</Card>
</section>
```

1. Pick the domain group; add the route under it. 2. Use `PageHeader` + `Card` + tokens.
3. Provide Empty/Loading/Error states. 4. Add a cross-link to the adjacent module.
5. Register in sidebar + ⌘K if it's a top-level destination.

---

## 7. Do / Don't

**Do:** use tokens, share components, keep one accent, design empty states, connect modules.
**Don't:** hardcode hex, invent a new button style, mix 3+ colors, skip breadcrumbs,
leave orphan menus, animate everything.
