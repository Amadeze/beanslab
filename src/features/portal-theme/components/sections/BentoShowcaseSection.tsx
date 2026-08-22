"use client";

import React from "react";
import { motion } from "framer-motion";
import { Coffee, Flame, Shield, Award, TrendingUp, Sparkles, MapPin, ArrowRight } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Coffee, Flame, Shield, Award, TrendingUp, Sparkles, MapPin, ArrowRight
};

const GRID_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

const ease = [0.22, 1, 0.36, 1] as const;

interface BentoShowcaseProps {
  settings: Record<string, unknown>;
  blocks: any[];
  typography?: any;
  layout?: any;
}

export function BentoShowcaseSection({ settings, blocks }: BentoShowcaseProps) {
  const title = (settings.title as string) || "Tampilan Bento Grosir";
  const subtitle = (settings.subtitle as string) || "Dirancang untuk keunggulan. Jelajahi profil sangrai, metrik cupping, dan jejak asal biji kami.";
  const columns = (settings.columns as number) || 4;
  const gapStyle = (settings.gapStyle as string) || "normal";

  const gapClass = 
    gapStyle === "tight" ? "gap-3" : 
    gapStyle === "loose" ? "gap-8" : 
    gapStyle === "relaxed" ? "gap-6" : "gap-4 sm:gap-6";

  const visibleBlocks = blocks.filter((b) => b.visible !== false);

  if (visibleBlocks.length === 0) return null;

  const displayBlocks = visibleBlocks;

  return (
    <section className="w-full py-14 sm:py-20 md:py-28" style={{ backgroundColor: "var(--portal-bg, #0F172A)", color: "var(--portal-text, #F8FAFC)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="max-w-3xl mb-8 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-xs font-bold uppercase tracking-widest bg-[var(--portal-accent,#D4A574)]/15 border border-[var(--portal-accent,#D4A574)]/30 text-[var(--portal-accent,#D4A574)] mb-3 sm:mb-4">
            <Sparkles size={14} /> Modular Architecture
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight sm:leading-none mb-3 sm:mb-4" style={{ fontFamily: "var(--portal-font-heading)" }}>
            {title}
          </h2>
          <p className="text-xs sm:text-base opacity-80 max-w-2xl leading-relaxed" style={{ fontFamily: "var(--portal-font-body)" }}>
            {subtitle}
          </p>
        </motion.div>

        {/* Bento Grid Container */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${GRID_COLS[columns] || "lg:grid-cols-4"} ${gapClass} auto-rows-[auto] sm:auto-rows-[240px]`}
        >
          {displayBlocks.map((block, idx) => {
            const st = block.settings || {};
            const colSpan = block.colSpan || st.colSpan || 1;
            const rowSpan = block.rowSpan || st.rowSpan || 1;
            const IconComponent = ICON_MAP[st.icon as string] || Coffee;
            const bgImg = st.imageUrl as string | undefined;

            return (
              <motion.div
                key={block.id || idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1, ease }}
                whileHover={{ scale: 1.015, translateY: -4 }}
                className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-2xl hover:border-white/25 min-h-[200px] sm:min-h-0
                  ${colSpan === 2 ? "md:col-span-2" : colSpan === 3 ? "lg:col-span-3" : colSpan === 4 ? "lg:col-span-4" : "col-span-1"}
                  ${rowSpan === 2 ? "sm:row-span-2" : rowSpan === 3 ? "sm:row-span-3" : "row-span-1"}
                `}
                style={{
                  background: bgImg 
                    ? `linear-gradient(to top, rgba(15, 23, 42, 0.95) 10%, rgba(15, 23, 42, 0.4) 60%), url(${bgImg}) center/cover no-repeat`
                    : "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)"
                }}
              >
                {/* No-Image Fallback */}
                {!bgImg && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                    <Coffee size={80} style={{ color: (st.accentColor as string) || "var(--portal-accent, #D4A574)" }} />
                  </div>
                )}

                {/* Glow Orb on Hover */}
                <div 
                  className="absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-30 blur-2xl transition-opacity duration-700 pointer-events-none"
                  style={{ backgroundColor: (st.accentColor as string) || "var(--portal-accent, #D4A574)" }}
                />

                {/* Top Row: Badge & Icon */}
                <div className="flex items-start justify-between gap-3 relative z-10">
                  {st.badge ? (
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border backdrop-blur-md"
                      style={{ 
                        backgroundColor: "rgba(0,0,0,0.4)",
                        borderColor: (st.accentColor as string) || "rgba(255,255,255,0.2)",
                        color: (st.accentColor as string) || "#fff"
                      }}
                    >
                      {st.badge as string}
                    </span>
                  ) : <div />}

                  <div 
                    className="w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10 bg-white/10 text-white group-hover:scale-110 transition-transform duration-300 shadow-sm shrink-0"
                    style={{ color: (st.accentColor as string) || "var(--portal-accent, #D4A574)" }}
                  >
                    <IconComponent size={20} />
                  </div>
                </div>

                {/* Bottom Row: Content & CTA */}
                <div className="relative z-10 mt-6 flex flex-col justify-end">
                  {st.subtitle && (
                    <span className="text-xs font-bold tracking-wider uppercase mb-1.5 opacity-70" style={{ color: (st.accentColor as string) || "var(--portal-accent, #D4A574)" }}>
                      {st.subtitle as string}
                    </span>
                  )}
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-snug mb-2 group-hover:text-[var(--portal-accent,#D4A574)] transition-colors">
                    {st.title as string}
                  </h3>
                  {st.content && (
                    <p className={`text-xs sm:text-sm opacity-75 leading-relaxed ${rowSpan === 1 ? "line-clamp-2" : "line-clamp-4"} mb-4`}>
                      {st.content as string}
                    </p>
                  )}
                  {st.ctaText && (
                    <a 
                      href={(st.ctaLink as string) || "#"}
                      className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest mt-2 group/btn"
                      style={{ color: (st.accentColor as string) || "var(--portal-accent, #D4A574)" }}
                    >
                      <span>{st.ctaText as string}</span>
                      <ArrowRight size={14} className="group-hover/btn:translate-x-1.5 transition-transform" />
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
