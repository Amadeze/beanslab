# B2B Portal Theme Redesign — Design Spec

## Problem Statement

The current B2B tenant portal (`TenantPortalLayout.tsx`, 677 lines) has:
1. **Monolithic switch-based styling** — 10 themes via `getContainerStyles()`, `getCardStyles()`, `getButtonStyles()` functions with hardcoded Tailwind classes per theme.
2. **No tiered pricing** — `priceSilver` and `priceGold` fields exist in the Product model but are never displayed or used.
3. **No MOQ indicator** — wholesale buyers can't see minimum order quantities.
4. **No product search/filter** — only category tabs exist; no search by name, origin, or roast level.
5. **Decorative overlays baked into JSX** — heritage texture and cyber scanlines are inline conditionals, not composable.
6. **Two parallel CSS variable systems** — `--t-*` (ThemedPrimitives) and `--theme-*` (TenantPortalLayout) coexist without unification.

## Approach: D — Shared Layout + ThemeSkin Objects

### Core Concept

Extract theme-specific styling into a `ThemeSkin` interface. The layout component consumes a single skin object instead of multiple switch statements. Section components are reusable and accept skin classes as props.

```
Before: TenantPortalLayout.tsx → switch(layoutStyle) × 3 functions × every section
After:  TenantPortalLayout.tsx → ThemeSkin object → passed to section components
```

---

## Phase 1: Extract ThemeSkin Interface + 10 Skin Definitions

### 1.1 Define ThemeSkin Interface

**New file:** `ros-app/src/app/tenant/[subdomain]/_components/themes/ThemeSkin.ts`

```typescript
export interface ThemeSkin {
  // Container (outermost wrapper)
  containerClass: string;
  // Cards
  cardClass: string;
  // Buttons
  buttonPrimaryClass: string;
  buttonSecondaryClass: string;
  // Hero image frame
  heroImageClass: string;
  // Decorative overlay (optional React node)
  overlay?: React.ReactNode;
  // Hero badge (optional, e.g. cyber terminal badge)
  heroBadge?: React.ReactNode;
}
```

### 1.2 Create 10 Skin Definitions

**New file:** `ros-app/src/app/tenant/[subdomain]/_components/themes/skins.ts`

Extract current switch cases into named objects:

```typescript
export const THEME_SKINS: Record<string, ThemeSkin> = {
  heritage: { ... },
  cyber: { ... },
  botanical: { ... },
  editorial: { ... },
  liquid: { ... },
  industrial: { ... },
  luxury: { ... },
  playful: { ... },
  club: { ... },
  neomodern: { ... }, // default
};
```

### 1.3 Resolve Skin in ThemeRouter/UniversalTheme

Pass `skin` as a new prop to `TenantPortalLayout`. The `ThemeRouter` or `UniversalTheme` resolves it from `tenant.layoutStyle`.

---

## Phase 2: Refactor TenantPortalLayout to Use ThemeSkin

### 2.1 Replace switch functions

Remove `getContainerStyles()`, `getCardStyles()`, `getButtonStyles()` from `TenantPortalLayout.tsx`. Replace all usages with `skin.containerClass`, `skin.cardClass`, `skin.buttonPrimaryClass`, etc.

### 2.2 Extract Section Components

Split the monolithic layout into reusable section components:

**New directory:** `ros-app/src/app/tenant/[subdomain]/_components/sections/`

| File | Section | Lines (current) |
|------|---------|-----------------|
| `HeaderSection.tsx` | Navbar + Cart button | 211-222 |
| `HeroSection.tsx` | Above the fold | 224-274 |
| `ProblemSolutionSection.tsx` | Problem + Solution | 276-297 |
| `FeaturesSection.tsx` | 3-column features | 299-320 |
| `UspSection.tsx` | Why Choose Us | 322-360 |
| `CatalogSection.tsx` | Product catalog (grid/table) | 362-577 |
| `TestimonialsSection.tsx` | Social proof | 579-604 |
| `FaqSection.tsx` | FAQ accordion | 606-641 |
| `FooterSection.tsx` | Footer | 643-675 |

Each section receives:
- Its content props (data)
- `skin` object (styling)
- `layoutStyle` string (for any remaining inline conditionals)

### 2.3 Slim down TenantPortalLayout.tsx

After extraction, `TenantPortalLayout.tsx` becomes a ~50-line orchestrator:

```typescript
export function TenantPortalLayout(props: ThemeProps & { skin: ThemeSkin }) {
  // ... data prep, state
  return (
    <div className={`w-full min-h-screen ${skin.containerClass}`}>
      {skin.overlay}
      <HeaderSection ... skin={skin} />
      <HeroSection ... skin={skin} />
      <ProblemSolutionSection ... skin={skin} />
      <FeaturesSection ... skin={skin} />
      <UspSection ... skin={skin} />
      <CatalogSection ... skin={skin} />
      <TestimonialsSection ... skin={skin} />
      <FaqSection ... skin={skin} />
      <FooterSection ... skin={skin} />
    </div>
  );
}
```

---

## Phase 3: B2B Features — Tiered Pricing Display

### 3.1 Extend ThemeProps

Add `customerTier` to ThemeProps (or resolve from tenant/customer context):

```typescript
customerTier?: "RETAIL" | "WHOLESALE_SILVER" | "WHOLESALE_GOLD";
```

### 3.2 Pricing Helper

**New file:** `ros-app/src/app/tenant/[subdomain]/_components/themes/pricing.ts`

```typescript
export function getDisplayPrice(product: Product, tier?: string): {
  price: number;
  originalPrice?: number;  // strikethrough if discounted
  tierLabel?: string;
} {
  switch (tier) {
    case "WHOLESALE_GOLD":
      return { price: Number(product.priceGold || product.price), tierLabel: "Gold" };
    case "WHOLESALE_SILVER":
      return { price: Number(product.priceSilver || product.price), tierLabel: "Silver" };
    default:
      return { price: Number(product.price || 0), tierLabel: "Retail" };
  }
}
```

### 3.3 Update CatalogSection

In the product card and table view, replace the single price display with:

```tsx
{/* Price Display — Tiered */}
<div className="...">
  <span>Harga</span>
  <div className="text-right">
    {tierLabel && <span className="text-xs ...">Tier {tierLabel}</span>}
    <span className="...">Rp {price.toLocaleString("id-ID")}</span>
    {originalPrice && (
      <span className="text-xs line-through text-[var(--theme-text-muted)]">
        Rp {originalPrice.toLocaleString("id-ID")}
      </span>
    )}
  </div>
</div>
```

### 3.4 Price Tiers Info Banner

Add a small info banner above the catalog explaining tier benefits (when customer is logged in as wholesale):

```tsx
{customerTier && customerTier !== "RETAIL" && (
  <div className="flex items-center gap-2 p-3 bg-[var(--theme-primary)]/10 ...">
    <Info size={16} />
    <span>Anda mendapatkan harga {tierLabel} — hemat hingga X%</span>
  </div>
)}
```

---

## Phase 4: B2B Features — Bulk Order & MOQ

### 4.1 MOQ Field

Add `moq` (Minimum Order Quantity) to the Product model or derive from tenant settings. For now, use a sensible default based on product type:

```typescript
// In CatalogSection
const getMoq = (product: Product) => {
  // If product has a moq field, use it; else default 1
  return (product as any).moq || 1;
};
```

**Future:** Add `moq Int default 1` to Product schema in Prisma.

### 4.2 MOQ Indicator on Product Card

```tsx
{moq > 1 && (
  <span className="text-xs text-[var(--theme-text-muted)]">
    Min. {moq} unit
  </span>
)}
```

### 4.3 Quantity Selector with MOQ Enforcement

Update `handleQtyChange` to enforce MOQ minimum:

```typescript
const handleQtyChange = (productId: string, delta: number, moq: number = 1) => {
  setQuantities(prev => {
    const current = prev[productId] || moq;
    const next = Math.max(moq, current + delta);
    return { ...prev, [productId]: next };
  });
};
```

### 4.4 Bulk Pricing Table (Optional Enhancement)

Add a "Lihat Harga Grosir" expandable row in table view showing price tiers:

```
| Qty    | Harga/unit    |
|--------|---------------|
| 1-9    | Rp 120.000    |
| 10-29  | Rp 110.000    |
| 30+    | Rp 95.000     |
```

---

## Phase 5: B2B Features — Product Search & Advanced Filtering

### 5.1 Search Bar

Add a search input above the catalog grid:

```tsx
const [searchQuery, setSearchQuery] = useState("");

const filteredProducts = useMemo(() => {
  let result = products;
  if (activeCategory !== "ALL") result = result.filter(p => p.category === activeCategory);
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.origin?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  }
  return result;
}, [products, activeCategory, searchQuery]);
```

### 5.2 Filter Chips for Origin & Roast Level

Add filter chips below the search bar:

```tsx
const [activeOrigin, setActiveOrigin] = useState<string>("ALL");
const [activeRoast, setActiveRoast] = useState<string>("ALL");

// Auto-detect from products
const origins = useMemo(() => {
  const set = new Set(products.filter(p => p.origin).map(p => p.origin));
  return ["ALL", ...Array.from(set)];
}, [products]);

const roastLevels = useMemo(() => {
  const set = new Set(products.filter(p => p.roastLevel).map(p => p.roastLevel));
  return ["ALL", ...Array.from(set)];
}, [products]);
```

### 5.3 Updated Filter Pipeline

```typescript
const filteredProducts = useMemo(() => {
  let result = products;
  if (activeCategory !== "ALL") result = result.filter(p => p.category === activeCategory);
  if (activeOrigin !== "ALL") result = result.filter(p => p.origin === activeOrigin);
  if (activeRoast !== "ALL") result = result.filter(p => p.roastLevel === activeRoast);
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.origin?.toLowerCase().includes(q)
    );
  }
  return result;
}, [products, activeCategory, activeOrigin, activeRoast, searchQuery]);
```

### 5.4 Active Filter Summary

Show active filters as removable chips with a "Reset" button.

---

## Phase 6: Unify CSS Variable Systems

### 6.1 Deprecate `--theme-*` aliases

The `ThemeEngine.tsx` currently emits BOTH `--t-*` and `--theme-*` variables. After refactoring `TenantPortalLayout.tsx` to use `ThemedPrimitives` or `--t-*` variables directly, the legacy `--theme-*` aliases in `ThemeEngine.tsx` can be kept for backward compatibility but no longer be the primary system.

### 6.2 Update Cart Drawer

`UniversalTheme.tsx` cart drawer currently uses `--theme-*` variables. Update to use `--t-*` for consistency.

---

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| **CREATE** | `themes/ThemeSkin.ts` | ThemeSkin interface definition |
| **CREATE** | `themes/skins.ts` | 10 ThemeSkin objects extracted from switch statements |
| **CREATE** | `themes/pricing.ts` | Tiered pricing helper |
| **CREATE** | `sections/HeaderSection.tsx` | Navbar component |
| **CREATE** | `sections/HeroSection.tsx` | Hero component |
| **CREATE** | `sections/ProblemSolutionSection.tsx` | Problem/Solution component |
| **CREATE** | `sections/FeaturesSection.tsx` | Features grid component |
| **CREATE** | `sections/UspSection.tsx` | USP component |
| **CREATE** | `sections/CatalogSection.tsx` | Catalog with search/filter/tiered pricing |
| **CREATE** | `sections/TestimonialsSection.tsx` | Testimonials component |
| **CREATE** | `sections/FaqSection.tsx` | FAQ accordion component |
| **CREATE** | `sections/FooterSection.tsx` | Footer component |
| **MODIFY** | `themes/TenantPortalLayout.tsx` | Slim down to ~50-line orchestrator |
| **MODIFY** | `themes/ThemeProps.ts` | Add `customerTier`, `skin` props |
| **MODIFY** | `themes/UniversalTheme.tsx` | Pass skin prop, update cart drawer CSS vars |
| **MODIFY** | `themes/ThemeRouter.tsx` | Resolve ThemeSkin, pass to layout |
| **KEEP** | `themes/ThemeEngine.tsx` | No changes needed |
| **KEEP** | `themes/ThemeConfig.ts` | No changes needed |
| **KEEP** | `themes/ThemedPrimitives.tsx` | No changes needed (still available for future use) |

## Scope Boundaries

### In Scope
- ThemeSkin extraction + 10 skin definitions
- Section component extraction (9 sections)
- Tiered pricing display (priceSilver, priceGold)
- MOQ indicator + quantity enforcement
- Product search by name/origin/description
- Filter chips for origin + roast level
- Active filter summary with reset

### Out of Scope (Future)
- Customer authentication/login on storefront (needed for automatic tier detection)
- Prisma schema changes (adding `moq` field to Product)
- Checkout API changes (tier-aware pricing in checkout)
- New theme designs beyond the existing 10
- Mobile app / PWA changes

## Migration Strategy

1. **Non-breaking:** All changes are additive. The `ThemeRouter` → `UniversalTheme` → `TenantPortalLayout` flow stays the same.
2. **Skin resolution:** `ThemeRouter` or `UniversalTheme` resolves `THEME_SKINS[layoutStyle]` and passes it as prop.
3. **Fallback:** If a skin key is not found, fall back to `THEME_SKINS.neomodern`.
4. **Testing:** Each section component can be tested in isolation with a mock skin.
