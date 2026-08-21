"use client";

import React from "react";
import { Coffee } from "lucide-react";
import { RepSection, RepHeading, RepText, RepButton } from "../components/PrimitiveRenderer";

// =============================================================================
// HERO SPLIT
// =============================================================================

export interface HeroSplitProps {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  imageUrl?: string;
  imagePosition?: "left" | "right";
}

export function HeroSplit({
  headline = "Dibuat dengan Penuh Semangat.",
  subheadline = "Pendekatan modern terhadap tradisi sangrai. Kami menghadirkan profil rasa unik dari setiap biji kopi.",
  ctaText = "Lihat Koleksi",
  imageUrl = "",
  imagePosition = "right"
}: HeroSplitProps) {
  return (
    <div className="w-full min-h-[80vh] flex items-center bg-[var(--rep-bg)]">
      <RepSection className="w-full">
        <div className={`flex flex-col md:flex-row gap-12 lg:gap-24 items-center ${imagePosition === "left" ? "md:flex-row-reverse" : ""}`}>

          {/* Text Content */}
          <div className="flex-1 w-full flex flex-col items-start text-left">
            <RepHeading level="display" className="mb-6">
              {headline}
            </RepHeading>
            <RepText size="lg" muted className="mb-8">
              {subheadline}
            </RepText>
            <RepButton size="lg" variant="primary">
              {ctaText}
            </RepButton>
          </div>

          {/* Image Content */}
          <div className="flex-1 w-full relative aspect-[4/5] md:aspect-square lg:aspect-[4/5] rounded-[var(--rep-radius)] overflow-hidden shadow-[var(--rep-shadow)] group bg-[var(--portal-surface-alt,#F5F3EF)]">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Banner hero"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Coffee size={64} className="opacity-20" style={{ color: "var(--portal-accent, #D4A574)" }} />
              </div>
            )}
          </div>

        </div>
      </RepSection>
    </div>
  );
}
