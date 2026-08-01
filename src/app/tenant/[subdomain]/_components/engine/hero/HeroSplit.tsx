"use client";

import React from "react";
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
  headline = "Crafted with Passion.",
  subheadline = "A modern approach to traditional roasting. We bring out the unique flavor profile of every single bean.",
  ctaText = "Explore Collection",
  imageUrl = "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&q=80&w=1000",
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
          <div className="flex-1 w-full relative aspect-[4/5] md:aspect-square lg:aspect-[4/5] rounded-[var(--rep-radius)] overflow-hidden shadow-[var(--rep-shadow)] group">
            <img 
              src={imageUrl} 
              alt="Hero banner for specialty coffee" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
          </div>
          
        </div>
      </RepSection>
    </div>
  );
}
