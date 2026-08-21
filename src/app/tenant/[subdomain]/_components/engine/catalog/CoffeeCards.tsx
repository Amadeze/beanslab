"use client";

import React from "react";
import { Coffee } from "lucide-react";
import { RepSection, RepHeading, RepText } from "../components/PrimitiveRenderer";

// =============================================================================
// COFFEE CARDS (CATALOG)
// =============================================================================
// Renders real products from the database. No hardcoded demo data.

export interface CoffeeCardsProps {
  headline?: string;
  subheadline?: string;
  products?: any[];
}

export function CoffeeCards({
  headline = "Koleksi Kami",
  subheadline = "Pilihan kopi yang dikurasi dan dipanggang untuk konsistensi.",
  products = [],
}: CoffeeCardsProps) {
  const displayItems = products.filter(
    (p) => p.type === "FINISHED_GOODS" || p.type === "ROASTED_BEAN",
  );

  if (displayItems.length === 0) {
    return (
      <div className="w-full bg-[var(--rep-bg)] py-12">
        <RepSection>
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <RepHeading level={1} className="mb-4">
              {headline}
            </RepHeading>
            <RepText size="lg" muted>
              {subheadline}
            </RepText>
          </div>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Coffee
              className="mb-4 h-12 w-12 opacity-25"
              strokeWidth={1}
            />
            <p className="text-sm font-medium opacity-50">
              Belum ada produk yang tersedia saat ini.
            </p>
          </div>
        </RepSection>
      </div>
    );
  }

  return (
    <div className="w-full bg-[var(--rep-bg)] py-12">
      <RepSection>
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <RepHeading level={1} className="mb-4">
            {headline}
          </RepHeading>
          <RepText size="lg" muted>
            {subheadline}
          </RepText>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayItems.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--rep-border)] bg-[var(--rep-surface)] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative aspect-square overflow-hidden bg-[var(--rep-bg)]">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Coffee
                      className="h-12 w-12 opacity-20"
                      strokeWidth={1}
                    />
                  </div>
                )}
                {item.origin && (
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
                    {item.origin}
                  </span>
                )}
                {item.roastLevel && (
                  <span className="absolute right-3 top-3 rounded-full bg-[var(--rep-primary, #6b4423)]/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
                    {item.roastLevel}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-base font-bold leading-tight line-clamp-2">
                  {item.name}
                </h3>
                {item.description && (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-5 opacity-55">
                    {item.description}
                  </p>
                )}
                <div className="mt-auto pt-4">
                  <p
                    className="text-lg font-black"
                    style={{
                      color: "var(--rep-primary, var(--t-primary, #6b4423))",
                    }}
                  >
                    Rp {Number(item.price || 0).toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </RepSection>
    </div>
  );
}
