"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coffee, ShoppingBag, Plus, Minus, Grid, List,
  Search, X, SlidersHorizontal, Info, Package,
} from "lucide-react";
import { ThemeSkin } from "../themes/ThemeSkin";
import { getDisplayPrice, formatPrice, getMoq, CustomerTier } from "../themes/pricing";
import type { Product } from "@prisma/client";
import {
  STOREFRONT_GRIND_LABEL,
  type StorefrontGrindSize,
} from "@/lib/storefront-grind";

type StorefrontProduct = Product & {
  recipes?: Array<{ storefrontGrindOptions: StorefrontGrindSize[] }>;
};

interface CatalogSectionProps {
  products: StorefrontProduct[];
  catalogTitle: string;
  catalogSubtitle: string;
  handleAddToCart: (product: Product, grindSize?: StorefrontGrindSize, customGrindLabel?: string | null) => void;
  customerTier?: CustomerTier;
  skin: ThemeSkin;
}

type SortOption = "name" | "price-asc" | "price-desc" | "stock";

function ProductVisual({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [imageUrl]);

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center bg-[var(--t-surface)] text-[var(--t-accent)] opacity-35">
        <Coffee size={40} strokeWidth={1} />
      </div>
      {imageUrl && !failed && (
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.05] ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ filter: "sepia(8%) saturate(95%)" }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}

export function CatalogSection({
  products, catalogTitle, catalogSubtitle, handleAddToCart, customerTier = "RETAIL", skin,
}: CatalogSectionProps) {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [activeOrigin, setActiveOrigin] = useState<string>("ALL");
  const [activeRoast, setActiveRoast] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [showFilters, setShowFilters] = useState(false);
  const [grindSelections, setGrindSelections] = useState<Record<string, StorefrontGrindSize>>({});
  const [customGrindLabels, setCustomGrindLabels] = useState<Record<string, string>>({});

  const categories = useMemo(() => {
    const set = new Set(products.filter(p => p.category).map(p => p.category!));
    return ["ALL", ...Array.from(set)];
  }, [products]);

  const origins = useMemo(() => {
    const set = new Set(products.filter(p => p.origin).map(p => p.origin!));
    return ["ALL", ...Array.from(set)];
  }, [products]);

  const roastLevels = useMemo(() => {
    const set = new Set(products.filter(p => p.roastLevel).map(p => p.roastLevel!));
    return ["ALL", ...Array.from(set)];
  }, [products]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeCategory !== "ALL") count++;
    if (activeOrigin !== "ALL") count++;
    if (activeRoast !== "ALL") count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [activeCategory, activeOrigin, activeRoast, searchQuery]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (activeCategory !== "ALL") result = result.filter(p => p.category === activeCategory);
    if (activeOrigin !== "ALL") result = result.filter(p => p.origin === activeOrigin);
    if (activeRoast !== "ALL") result = result.filter(p => p.roastLevel === activeRoast);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.origin?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case "price-asc": result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0)); break;
      case "price-desc": result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0)); break;
      case "stock": result.sort((a, b) => Number(b.stockKg || 0) - Number(a.stockKg || 0)); break;
      default: result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return result;
  }, [products, activeCategory, activeOrigin, activeRoast, searchQuery, sortBy]);

  const handleQtyChange = (productId: string, delta: number, moq: number = 1) => {
    setQuantities(prev => {
      const current = prev[productId] || moq;
      return { ...prev, [productId]: Math.max(moq, current + delta) };
    });
  };

  const handleBulkAdd = (product: any) => {
    const moq = getMoq(product);
    const qty = quantities[product.id] || moq;
    const options: StorefrontGrindSize[] = product.recipes?.[0]?.storefrontGrindOptions ?? ["WHOLE_BEAN"];
    const grindSize = grindSelections[product.id] ?? options[0] ?? "WHOLE_BEAN";
    const customLabel = grindSize === "CUSTOM" ? customGrindLabels[product.id]?.trim() || null : null;
    if (grindSize === "CUSTOM" && !customLabel) return;
    for (let i = 0; i < qty; i++) handleAddToCart(product, grindSize, customLabel);
    setQuantities(prev => ({ ...prev, [product.id]: moq }));
  };

  const grindPicker = (product: StorefrontProduct) => {
    const options = product.recipes?.[0]?.storefrontGrindOptions ?? ["WHOLE_BEAN"];
    const selected = grindSelections[product.id] ?? options[0] ?? "WHOLE_BEAN";
    if (options.length === 1 && selected === "WHOLE_BEAN") return null;
    return (
      <div className="space-y-2">
        <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--t-text-muted)]">
          Mau digiling?
        </label>
        <select
          value={selected}
          onChange={(event) => setGrindSelections((current) => ({
            ...current,
            [product.id]: event.target.value as StorefrontGrindSize,
          }))}
          className="h-9 w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] px-3 text-xs text-[var(--t-text)]"
        >
          {options.map((option) => (
            <option key={option} value={option}>{STOREFRONT_GRIND_LABEL[option]}</option>
          ))}
        </select>
        {selected === "CUSTOM" && (
          <input
            value={customGrindLabels[product.id] ?? ""}
            onChange={(event) => setCustomGrindLabels((current) => ({ ...current, [product.id]: event.target.value }))}
            placeholder="Contoh: Comandante 22 klik"
            className="h-9 w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] px-3 text-xs text-[var(--t-text)]"
          />
        )}
      </div>
    );
  };

  const resetFilters = () => {
    setActiveCategory("ALL");
    setActiveOrigin("ALL");
    setActiveRoast("ALL");
    setSearchQuery("");
    setSortBy("name");
  };

  const removeFilter = (type: string) => {
    switch (type) {
      case "category": setActiveCategory("ALL"); break;
      case "origin": setActiveOrigin("ALL"); break;
      case "roast": setActiveRoast("ALL"); break;
      case "search": setSearchQuery(""); break;
    }
  };

  const tierInfo = customerTier !== "RETAIL"
    ? getDisplayPrice({ price: 100, priceSilver: 90, priceGold: 80 }, customerTier)
    : null;

  const FilterPill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-300 ${
        active
          ? "bg-[var(--t-primary)] text-white shadow-[0_2px_8px_rgba(107,68,35,0.15)]"
          : "bg-[var(--t-surface)] text-[var(--t-text-muted)] hover:bg-[var(--t-surface)] border border-[var(--t-border)]"
      }`}
      style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
    >
      {label}
    </button>
  );

  return (
    <section id="catalog" className="w-full bg-[var(--t-bg)]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-28">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8"
        >
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-[1px] bg-[var(--t-accent)]" />
              <span
                className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--t-text-muted)]"
                style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
              >
                {catalogSubtitle}
              </span>
            </div>
            <h2
              className="text-3xl md:text-4xl font-semibold tracking-tight text-[var(--t-text)]"
              style={{ fontFamily: "'Playfair Display', 'Source Serif 4', Georgia, serif" }}
            >
              {catalogTitle}
            </h2>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-[var(--t-border)] rounded-2xl p-1 bg-[var(--t-surface)]">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-xl transition-all duration-300 ${viewMode === "grid" ? "bg-[var(--t-primary)] text-white shadow-sm" : "text-[var(--t-text-muted)] hover:text-[var(--t-text)]"}`}
              title="Grid View"
            >
              <Grid size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-xl transition-all duration-300 ${viewMode === "table" ? "bg-[var(--t-primary)] text-white shadow-sm" : "text-[var(--t-text-muted)] hover:text-[var(--t-text)]"}`}
              title="Table View"
            >
              <List size={16} strokeWidth={1.5} />
            </button>
          </div>
        </motion.div>

        {/* Tier Info Banner */}
        {customerTier !== "RETAIL" && tierInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-[var(--t-primary)]/5 border border-[var(--t-primary)]/10"
          >
            <Info size={18} className="text-[var(--t-accent)]" strokeWidth={1.5} />
            <p
              className="text-sm text-[var(--t-text)]"
              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
            >
              You&apos;re viewing <span className="font-semibold">{tierInfo.tierLabel}</span> pricing.
              {tierInfo.savingsPercent > 0 && (
                <span className="ml-1 font-semibold text-[var(--t-primary)]">Save up to {tierInfo.savingsPercent}%</span>
              )}
            </p>
          </motion.div>
        )}

        {/* Search + Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--t-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coffee, origin, or category..."
              className="w-full pl-10 pr-10 py-3 text-sm rounded-2xl bg-[var(--t-surface)] border border-[var(--t-border)] text-[var(--t-text)] placeholder:text-[var(--t-text-muted)]/50 focus:outline-none focus:border-[var(--t-accent)] focus:ring-1 focus:ring-[#c8956c]/20 transition-all duration-300"
              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--t-text-muted)] hover:text-[var(--t-text)] transition-colors"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-2xl border transition-all duration-300 ${
                showFilters
                  ? "bg-[var(--t-primary)]/5 border-[var(--t-primary)]/20 text-[var(--t-primary)]"
                  : "bg-[var(--t-surface)] border-[var(--t-border)] text-[var(--t-text-muted)] hover:border-[var(--t-accent)]/30"
              }`}
              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
            >
              <SlidersHorizontal size={14} strokeWidth={1.5} />
              Filter
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 flex items-center justify-center text-xs font-medium rounded-full bg-[var(--t-primary)] text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-3 text-sm rounded-2xl bg-[var(--t-surface)] border border-[var(--t-border)] text-[var(--t-text)] cursor-pointer focus:outline-none focus:border-[var(--t-accent)] transition-all duration-300"
              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
            >
              <option value="name">Name A-Z</option>
              <option value="price-asc">Price: Low</option>
              <option value="price-desc">Price: High</option>
              <option value="stock">Most Stock</option>
            </select>
          </div>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden mb-6"
            >
              <div className="p-6 rounded-[20px] border border-[var(--t-border)] bg-[var(--t-surface)] space-y-5">
                {categories.length > 2 && (
                  <div>
                    <label
                      className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--t-text-muted)] mb-2 block"
                      style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                    >
                      Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <FilterPill key={cat} label={cat === "ALL" ? "All" : cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
                      ))}
                    </div>
                  </div>
                )}
                {origins.length > 2 && (
                  <div>
                    <label
                      className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--t-text-muted)] mb-2 block"
                      style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                    >
                      Origin
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {origins.map(origin => (
                        <FilterPill key={origin} label={origin === "ALL" ? "All Origins" : origin} active={activeOrigin === origin} onClick={() => setActiveOrigin(origin)} />
                      ))}
                    </div>
                  </div>
                )}
                {roastLevels.length > 2 && (
                  <div>
                    <label
                      className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--t-text-muted)] mb-2 block"
                      style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                    >
                      Roast Level
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {roastLevels.map(level => (
                        <FilterPill key={level} label={level === "ALL" ? "All Roasts" : level?.replace("_", " ")} active={activeRoast === level} onClick={() => setActiveRoast(level)} />
                      ))}
                    </div>
                  </div>
                )}
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="text-xs font-medium text-[var(--t-primary)] hover:text-[#5a3920] underline underline-offset-2 transition-colors"
                    style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {activeCategory !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-[var(--t-primary)]/8 text-[var(--t-primary)]">
                {activeCategory}
                <button onClick={() => removeFilter("category")} className="hover:opacity-60 transition-opacity"><X size={12} strokeWidth={1.5} /></button>
              </span>
            )}
            {activeOrigin !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-[var(--t-primary)]/8 text-[var(--t-primary)]">
                {activeOrigin}
                <button onClick={() => removeFilter("origin")} className="hover:opacity-60 transition-opacity"><X size={12} strokeWidth={1.5} /></button>
              </span>
            )}
            {activeRoast !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-[var(--t-primary)]/8 text-[var(--t-primary)]">
                {activeRoast?.replace("_", " ")}
                <button onClick={() => removeFilter("roast")} className="hover:opacity-60 transition-opacity"><X size={12} strokeWidth={1.5} /></button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-[var(--t-primary)]/8 text-[var(--t-primary)]">
                &ldquo;{searchQuery}&rdquo;
                <button onClick={() => removeFilter("search")} className="hover:opacity-60 transition-opacity"><X size={12} strokeWidth={1.5} /></button>
              </span>
            )}
          </div>
        )}

        {/* Results Count */}
        <p
          className="text-sm text-[var(--t-text-muted)] mb-6"
          style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
        >
          {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"} found
        </p>

        {/* Empty State */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 rounded-[20px] border-2 border-dashed border-[var(--t-border)]">
            <Coffee size={48} strokeWidth={1} className="mx-auto mb-4 opacity-20 text-[var(--t-text-muted)]" />
            <p
              className="text-[var(--t-text-muted)] mb-3"
              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
            >
              No products match your filters.
            </p>
            <button
              onClick={resetFilters}
              className="text-sm font-medium text-[var(--t-primary)] hover:text-[#5a3920] underline underline-offset-2 transition-colors"
              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === "grid" ? (
          /* ═══ GRID VIEW — Boutique product cards ═══ */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {filteredProducts.map((product, i) => {
              const moq = getMoq(product);
              const qty = quantities[product.id] || moq;
              const hasStock = product.stockKg ? Number(product.stockKg) > 0 : true;
              const pricing = getDisplayPrice(product, customerTier);
              const showTierPrice = customerTier !== "RETAIL" && pricing.savingsPercent > 0;

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20, rotate: -0.5 }}
                  whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: Math.min(i * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -4, transition: { duration: 0.35 } }}
                  className="group"
                >
                  <div className="relative rounded-[20px] overflow-hidden bg-[var(--t-surface)] border border-[var(--t-border)] transition-all duration-500 group-hover:shadow-[0_16px_40px_rgba(107,68,35,0.08)] group-hover:border-[var(--t-accent)]/30 h-full flex flex-col">
                    {/* Image */}
                    <div className="relative w-full aspect-[4/3] overflow-hidden bg-[var(--t-surface)]">
                      <ProductVisual imageUrl={product.imageUrl} name={product.name} />

                      {/* Stock badge */}
                      <span className={`absolute top-3 left-3 text-xs uppercase font-medium tracking-[0.1em] px-2.5 py-1 rounded-lg backdrop-blur-md ${
                        hasStock ? "bg-[#4a7c59]/85 text-white" : "bg-[#8b7e74]/85 text-white"
                      }`}
                        style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                      >
                        {hasStock ? (product.stockKg ? `${product.stockKg} Kg` : "Available") : "Sold Out"}
                      </span>

                      {/* Tier Savings */}
                      {showTierPrice && (
                        <span
                          className="absolute top-3 right-3 text-xs uppercase font-medium tracking-[0.1em] px-2.5 py-1 rounded-lg bg-[var(--t-accent)]/90 text-white backdrop-blur-md"
                          style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                        >
                          -{pricing.savingsPercent}%
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col flex-1">
                      <h3
                        className="text-base font-semibold text-[var(--t-text)] mb-1 line-clamp-1"
                        style={{ fontFamily: "'Playfair Display', 'Source Serif 4', Georgia, serif" }}
                      >
                        {product.name}
                      </h3>
                      <p
                        className="text-xs text-[var(--t-text-muted)] line-clamp-2 mb-3 font-normal leading-[1.7]"
                        style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                      >
                        {product.description || "A premium profile with refined character."}
                      </p>

                      {/* Origin + Roast */}
                      {(product.origin || product.roastLevel) && (
                        <div className="flex items-center gap-2 mb-4 text-xs uppercase tracking-[0.1em] text-[var(--t-text-muted)] font-medium">
                          {product.origin && <span>{product.origin}</span>}
                          {product.origin && product.roastLevel && <span className="opacity-30">&bull;</span>}
                          {product.roastLevel && <span>{product.roastLevel.replace("_", " ")}</span>}
                        </div>
                      )}

                      {/* Price + Add to Cart */}
                      <div className="mt-auto space-y-3">
                        <div className="flex justify-between items-end bg-[var(--t-bg)] p-3 rounded-2xl border border-[var(--t-border)]">
                          <div className="flex flex-col">
                            <span
                              className="text-xs text-[var(--t-text-muted)] uppercase tracking-[0.1em] font-medium"
                              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                            >
                              Price
                            </span>
                            {showTierPrice && (
                              <span className="text-xs font-semibold text-[var(--t-primary)]">Tier {pricing.tierLabel}</span>
                            )}
                          </div>
                          <div className="text-right">
                            {showTierPrice && (
                              <div className="text-xs line-through text-[var(--t-text-muted)]/40">
                                {formatPrice(pricing.retailPrice)}
                              </div>
                            )}
                            <span
                              className="text-base font-semibold text-[var(--t-primary)]"
                              style={{ fontFamily: "'Playfair Display', 'Source Serif 4', Georgia, serif" }}
                            >
                              {formatPrice(pricing.price)}
                            </span>
                          </div>
                        </div>

                        {/* MOQ */}
                        {moq > 1 && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--t-text-muted)] font-medium">
                            <Package size={12} strokeWidth={1.5} />
                            <span style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>Min. order: {moq} units</span>
                          </div>
                        )}

                        {grindPicker(product)}

                        {/* Quantity + Add to Cart */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center border border-[var(--t-border)] rounded-2xl overflow-hidden bg-[var(--t-surface)]">
                            <button
                              onClick={() => handleQtyChange(product.id, -1, moq)}
                              disabled={qty <= moq}
                              className="w-9 h-9 flex items-center justify-center text-sm font-medium hover:bg-[var(--t-bg)] disabled:opacity-30 transition-colors"
                            >
                              <Minus size={14} strokeWidth={1.5} />
                            </button>
                            <span
                              className="text-sm font-medium w-8 text-center text-[var(--t-text)]"
                              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                            >
                              {qty}
                            </span>
                            <button
                              onClick={() => handleQtyChange(product.id, 1, moq)}
                              className="w-9 h-9 flex items-center justify-center text-sm font-medium hover:bg-[var(--t-bg)] transition-colors"
                            >
                              <Plus size={14} strokeWidth={1.5} />
                            </button>
                          </div>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleBulkAdd(product)}
                            disabled={!hasStock}
                            aria-label={hasStock ? `Add ${product.name} to cart` : `${product.name} is sold out`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 font-medium text-sm rounded-2xl transition-all duration-300 bg-[var(--t-primary)] text-[var(--t-bg)] hover:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(107,68,35,0.15)]"
                            style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                          >
                            <ShoppingBag size={14} strokeWidth={1.5} />
                            <span>{hasStock ? "Add" : "Sold Out"}</span>
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* ═══ TABLE VIEW ═══ */
          <div className="w-full overflow-x-auto rounded-[20px] border border-[var(--t-border)] bg-[var(--t-surface)]">
            <table className="w-full border-collapse text-left text-sm text-[var(--t-text)]">
              <thead>
                <tr className="border-b border-[var(--t-border)] bg-[var(--t-bg)]">
                  {["Product", "Origin", "Category", "Stock", "Price", "Qty", "Action"].map(h => (
                    <th
                      key={h}
                      className="p-4 font-medium text-[11px] uppercase tracking-[0.12em] text-[var(--t-text-muted)]"
                      style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                    >
                      {h === "Price" && customerTier !== "RETAIL" ? `Price (${getDisplayPrice(products[0] || {}, customerTier).tierLabel})` : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e0d8]">
                {filteredProducts.map(product => {
                  const moq = getMoq(product);
                  const qty = quantities[product.id] || moq;
                  const hasStock = product.stockKg ? Number(product.stockKg) > 0 : true;
                  const pricing = getDisplayPrice(product, customerTier);
                  const showTierPrice = customerTier !== "RETAIL" && pricing.savingsPercent > 0;

                  return (
                    <tr key={product.id} className="hover:bg-[var(--t-bg)]/60 transition-colors duration-300">
                      <td
                        className="p-4 font-semibold max-w-[200px] truncate"
                        style={{ fontFamily: "'Playfair Display', 'Source Serif 4', Georgia, serif" }}
                      >
                        {product.name}
                      </td>
                      <td
                        className="p-4 text-[var(--t-text-muted)] text-xs"
                        style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                      >
                        {product.origin || "—"}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--t-primary)]/8 text-[var(--t-primary)] uppercase tracking-[0.1em]">
                          {product.category || "General"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`font-medium text-xs ${hasStock ? "text-[#4a7c59]" : "text-[var(--t-text-muted)]"}`}>
                          {hasStock ? (product.stockKg ? `${product.stockKg} Kg` : "Available") : "Out"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end">
                          {showTierPrice && (
                            <span className="text-xs line-through text-[var(--t-text-muted)]/40">{formatPrice(pricing.retailPrice)}</span>
                          )}
                          <span
                            className="font-semibold text-[var(--t-primary)]"
                            style={{ fontFamily: "'Playfair Display', 'Source Serif 4', Georgia, serif" }}
                          >
                            {formatPrice(pricing.price)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleQtyChange(product.id, -1, moq)}
                            disabled={qty <= moq}
                            className="w-7 h-7 rounded-xl bg-[var(--t-bg)] border border-[var(--t-border)] text-xs font-medium flex items-center justify-center disabled:opacity-30 transition-colors"
                          >
                            −
                          </button>
                          <span
                            className="text-sm font-medium w-5 text-center"
                            style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                          >
                            {qty}
                          </span>
                          <button
                            onClick={() => handleQtyChange(product.id, 1, moq)}
                            className="w-7 h-7 rounded-xl bg-[var(--t-bg)] border border-[var(--t-border)] text-xs font-medium flex items-center justify-center transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="mb-2 min-w-40">{grindPicker(product)}</div>
                        <button
                          onClick={() => handleBulkAdd(product)}
                          disabled={!hasStock}
                          aria-label={hasStock ? `Add ${product.name} to cart` : `${product.name} is sold out`}
                          className="flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-medium rounded-2xl transition-all duration-300 bg-[var(--t-primary)] text-[var(--t-bg)] hover:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(107,68,35,0.15)]"
                          style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                        >
                          <ShoppingBag size={12} strokeWidth={1.5} />
                          <span>Order</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
