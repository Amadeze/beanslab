"use client";

import { motion } from "framer-motion";
import { ShoppingBag, Plus, Coffee, Tag } from "lucide-react";
import { useState } from "react";
import { STOREFRONT_GRIND_LABEL, type StorefrontGrindSize } from "@/lib/storefront-grind";
import type { StorefrontOffering } from "@/lib/storefront-grind";
import { CoffeeOfferingCard } from "@/components/storefront/CoffeeOfferingCard";
import { StorefrontImage } from "../StorefrontImage";

interface CatalogGridProps {
  settings: Record<string, unknown>;
  blocks?: any[];
  typography?: any;
  layout?: any;
  isPreview?: boolean;
  products?: any[];
  offerings?: StorefrontOffering[];
  onAddToCart?: (product: any, grindSize?: StorefrontGrindSize, customGrindLabel?: string | null) => void;
  onAddOfferingToCart?: (
    offering: StorefrontOffering,
    variant: StorefrontOffering["variants"][number],
    grindSize?: StorefrontGrindSize,
    customGrindLabel?: string | null,
  ) => void;
}

const ease = [0.22, 1, 0.36, 1] as const;

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

type CoffeeOfferingCardPropsAppearance = "clean_grid" | "editorial_list" | "field_cards" | "brutalist_grid" | "reserve_gallery" | "community_cards";

export function CatalogGridSection({ settings, typography, products = [], offerings = [], onAddToCart, onAddOfferingToCart, isPreview }: CatalogGridProps) {
  const title = (settings.title as string) || "Koleksi Kami";
  const subtitle = (settings.subtitle as string) || "";
  const columns = (settings.columns as number) || 3;
  const styleMode = (settings.styleMode as CoffeeOfferingCardPropsAppearance) || "clean_grid";
  const showPrices = settings.showPrices !== false;
  const [grindSelections, setGrindSelections] = useState<Record<string, StorefrontGrindSize>>({});
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});

  const displayProducts = products && products.length > 0 ? products : null;

  const catalogGrid = styleMode === "editorial_list"
    ? "grid grid-cols-1 gap-px"
    : styleMode === "reserve_gallery"
      ? "grid grid-cols-1 gap-10 md:grid-cols-2"
      : styleMode === "brutalist_grid"
        ? "grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        : "grid grid-cols-1 gap-6 md:grid-cols-2";

  return (
    <section data-catalog-style={styleMode} className={`w-full ${styleMode === "brutalist_grid" ? "border-y-4" : ""}`} style={{ backgroundColor: "var(--portal-bg, #080B0C)", borderColor: "var(--portal-text, transparent)" }}>
      <div className={`mx-auto px-5 py-20 sm:px-8 md:py-28 ${styleMode === "editorial_list" ? "max-w-7xl" : styleMode === "reserve_gallery" ? "max-w-5xl" : "max-w-6xl"}`}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className={`${styleMode === "editorial_list" || styleMode === "brutalist_grid" || styleMode === "field_cards" ? "mb-12 max-w-3xl text-left" : "mx-auto mb-16 max-w-2xl text-center"}`}
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
            <span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
              Produk Kami
            </span>
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
          </div>
          <h2
            className="text-3xl md:text-4xl font-semibold tracking-tight mb-4"
            style={{
              color: "var(--portal-text, #1A1A1A)",
              fontFamily: typography?.font || "var(--portal-font-heading)",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="text-base leading-[1.75]"
              style={{ color: "var(--portal-text-muted, #6B7280)", fontFamily: "var(--portal-font-body)" }}
            >
              {subtitle}
            </p>
          )}
        </motion.div>

        {offerings.length > 0 ? (
          <div className={`mb-12 ${catalogGrid}`}>
            {offerings.map((offering) => (
              <CoffeeOfferingCard
                key={offering.id}
                offering={offering}
                appearance={styleMode}
                preview={isPreview}
                onAdd={onAddOfferingToCart ? ({ variant, grindSize, customGrindLabel, quantity }) => {
                  for (let index = 0; index < quantity; index += 1) {
                    onAddOfferingToCart(offering, variant, grindSize, customGrindLabel);
                  }
                } : undefined}
              />
            ))}
          </div>
        ) : null}

        {/* Real Products Grid */}
        {displayProducts ? (
          <div
            className={`grid gap-6 md:gap-8 ${GRID_COLS[Math.min(columns, 4)] || GRID_COLS[3]}`}
          >
            {displayProducts.map((product: any, i: number) => (
              <motion.div
                key={product.id || i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: (i % 6) * 0.1, ease }}
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
                className="group flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 shadow-sm hover:shadow-lg"
                style={{
                  backgroundColor: "var(--portal-surface, #fff)",
                  borderColor: "var(--portal-border-subtle, #F0F0F0)",
                }}
              >
                <div
                  className="aspect-square relative flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: "var(--portal-surface-alt, #F5F3EF)" }}
                >
                  {product.imageUrl ? (
                    <StorefrontImage
                      src={product.imageUrl}
                      alt={product.name}
                      width={800}
                      height={800}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <Coffee
                      size={48}
                      strokeWidth={1.2}
                      style={{ color: "var(--portal-accent, #D4A574)", opacity: 0.4 }}
                    />
                  )}
                  {product.roastLevel && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-black/60 text-white backdrop-blur-sm">
                      {product.roastLevel}
                    </span>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    {product.origin && (
                      <div className="flex items-center gap-1.5 text-[11px] mb-1.5" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
                        <Tag size={12} />
                        <span>{product.origin}</span>
                      </div>
                    )}
                    <h3
                      className="text-lg font-semibold tracking-tight line-clamp-1"
                      style={{ color: "var(--portal-text, #1A1A1A)", fontFamily: "var(--portal-font-heading)" }}
                    >
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="mt-1 text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
                        {product.description}
                      </p>
                    )}
                  </div>

                  {(() => {
                    const options: StorefrontGrindSize[] = product.recipes?.[0]?.storefrontGrindOptions ?? ["WHOLE_BEAN"];
                    const selected = grindSelections[product.id] ?? options[0] ?? "WHOLE_BEAN";
                    if (options.length === 1 && selected === "WHOLE_BEAN") return null;
                    return <div className="space-y-2">
                      <label htmlFor={`grind-${product.id}`} className="block text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--portal-text-muted, #6B7280)" }}>Pilihan gilingan</label>
                      <select
                        id={`grind-${product.id}`}
                        value={selected}
                        onChange={(event) => setGrindSelections((current) => ({ ...current, [product.id]: event.target.value as StorefrontGrindSize }))}
                        className="h-9 w-full rounded-xl border bg-transparent px-3 text-xs"
                        style={{ borderColor: "var(--portal-border, #E5E7EB)", color: "var(--portal-text, #1A1A1A)" }}
                      >
                        {options.map((option) => <option key={option} value={option}>{STOREFRONT_GRIND_LABEL[option]}</option>)}
                      </select>
                      {selected === "CUSTOM" ? <><label htmlFor={`custom-grind-${product.id}`} className="sr-only">Catatan gilingan {product.name}</label><input
                        id={`custom-grind-${product.id}`}
                        value={customLabels[product.id] ?? ""}
                        onChange={(event) => setCustomLabels((current) => ({ ...current, [product.id]: event.target.value }))}
                        placeholder="Contoh: Comandante 22 klik"
                        className="h-9 w-full rounded-xl border bg-transparent px-3 text-xs"
                        style={{ borderColor: "var(--portal-border, #E5E7EB)", color: "var(--portal-text, #1A1A1A)" }}
                      /></> : null}
                    </div>;
                  })()}

                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--portal-border-subtle, #F0F0F0)" }}>
                    {showPrices && (
                      <div>
                        <span className="text-xs block uppercase font-medium" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
                          Harga / kg
                        </span>
                        <span className="text-base font-bold" style={{ color: "var(--portal-primary, #D4A574)" }}>
                          Rp {Number(product.price || 0).toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        const options: StorefrontGrindSize[] = product.recipes?.[0]?.storefrontGrindOptions ?? ["WHOLE_BEAN"];
                        const grindSize = grindSelections[product.id] ?? options[0] ?? "WHOLE_BEAN";
                        const customLabel = grindSize === "CUSTOM" ? customLabels[product.id]?.trim() || null : null;
                        if (grindSize !== "CUSTOM" || customLabel) onAddToCart?.(product, grindSize, customLabel);
                      }}
                      aria-label={`Add ${product.name} to cart`}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95"
                      style={{
                        backgroundColor: "var(--portal-primary, #D4A574)",
                        color: "var(--portal-text-inverse, #fff)",
                      }}
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      <span>Pesan</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : offerings.length === 0 ? (
          /* Placeholder Grid when no products available */
          <div
            className={`grid gap-6 ${GRID_COLS[Math.min(columns, 4)] || GRID_COLS[3]}`}
          >
            {Array.from({ length: Math.min(columns, 6) }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1, ease }}
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
                className="group rounded-2xl border overflow-hidden transition-all duration-300"
                style={{
                  backgroundColor: "var(--portal-surface, #fff)",
                  borderColor: "var(--portal-border-subtle, #F0F0F0)",
                }}
              >
                <div
                  className="aspect-square flex items-center justify-center"
                  style={{ backgroundColor: "var(--portal-surface-alt, #F5F3EF)" }}
                >
                  <ShoppingBag
                    size={40}
                    strokeWidth={1}
                    style={{ color: "var(--portal-accent, #D4A574)", opacity: 0.3 }}
                  />
                </div>
                <div className="p-5">
                  <div className="h-4 w-3/4 rounded mb-2" style={{ backgroundColor: "var(--portal-surface-alt, #F5F3EF)" }} />
                  <div className="h-3 w-1/2 rounded" style={{ backgroundColor: "var(--portal-surface-alt, #F5F3EF)" }} />
                </div>
              </motion.div>
            ))}
          </div>
        ) : null}

        {isPreview && !displayProducts && (
          <p className="mt-8 text-center text-xs" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
            Produk akan ditampilkan secara dinamis dari katalog inventaris Anda
          </p>
        )}
      </div>
    </section>
  );
}
