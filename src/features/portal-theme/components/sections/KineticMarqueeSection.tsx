"use client";

import React from "react";
import { Sparkles } from "lucide-react";

interface KineticMarqueeProps {
  settings: Record<string, unknown>;
  blocks?: any[];
}

export function KineticMarqueeSection({ settings, blocks }: KineticMarqueeProps) {
  const speed = (settings.speed as number) || 30; // seconds for full loop
  const styleMode = (settings.styleMode as string) || "outline"; // outline, solid, neon, brutalist
  const direction = (settings.direction as string) || "left"; // left or right

  const visibleBlocks = blocks?.filter((block) => block.visible !== false) ?? [];
  const blockItems = visibleBlocks
    .map((block) => String(block.settings?.text ?? "").trim())
    .filter(Boolean);
  const fallbackTitle = String(settings.title ?? "").trim();
  const items = blockItems.length > 0 ? blockItems : fallbackTitle ? [fallbackTitle] : [];

  if (items.length === 0) return null;

  const animationClass = direction === "right" ? "animate-marquee-right" : "animate-marquee";

  return (
    <section 
      className="w-full py-8 md:py-12 overflow-hidden select-none border-y border-white/10 relative"
      style={{ backgroundColor: "var(--portal-bg, #090D16)", color: "var(--portal-text, #F8FAFC)" }}
    >
      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes marquee-right {
          0% { transform: translate3d(-50%, 0, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        .animate-marquee {
          display: flex;
          width: fit-content;
          animation: marquee ${speed}s linear infinite;
        }
        .animate-marquee-right {
          display: flex;
          width: fit-content;
          animation: marquee-right ${speed}s linear infinite;
        }
        .animate-marquee:hover, .animate-marquee-right:hover {
          animation-play-state: paused;
        }
        .text-outline {
          color: transparent;
          -webkit-text-stroke: 1.5px var(--portal-accent, #D4A574);
          transition: all 0.3s ease;
        }
        .text-outline:hover {
          color: var(--portal-accent, #D4A574);
          text-shadow: 0 0 20px rgba(212, 165, 116, 0.4);
        }
      `}</style>

      {/* Marquee Track (duplicating list twice to ensure infinite scroll) */}
      <div className={animationClass}>
        <div className="flex items-center gap-12 sm:gap-20 shrink-0 px-6">
          {items.map((item, idx) => (
            <div key={`col1-${idx}`} className="flex items-center gap-6 sm:gap-10">
              <span 
                className={`text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter uppercase whitespace-nowrap transition-all cursor-default ${
                  styleMode === "outline" ? "text-outline font-mono" :
                  styleMode === "neon" ? "text-[var(--portal-accent,#D4A574)] drop-shadow-[0_0_15px_rgba(212,165,116,0.6)]" :
                  styleMode === "brutalist" ? "bg-[var(--portal-accent,#D4A574)] text-black px-4 py-1 rounded-none font-mono tracking-widest" :
                  "text-white/90 hover:text-[var(--portal-accent,#D4A574)]"
                }`}
              >
                {item}
              </span>
              <span className="text-[var(--portal-accent,#D4A574)] opacity-40">
                <Sparkles size={24} />
              </span>
            </div>
          ))}
        </div>

        {/* Duplicate Track */}
        <div className="flex items-center gap-12 sm:gap-20 shrink-0 px-6" aria-hidden="true">
          {items.map((item, idx) => (
            <div key={`col2-${idx}`} className="flex items-center gap-6 sm:gap-10">
              <span 
                className={`text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter uppercase whitespace-nowrap transition-all cursor-default ${
                  styleMode === "outline" ? "text-outline font-mono" :
                  styleMode === "neon" ? "text-[var(--portal-accent,#D4A574)] drop-shadow-[0_0_15px_rgba(212,165,116,0.6)]" :
                  styleMode === "brutalist" ? "bg-[var(--portal-accent,#D4A574)] text-black px-4 py-1 rounded-none font-mono tracking-widest" :
                  "text-white/90 hover:text-[var(--portal-accent,#D4A574)]"
                }`}
              >
                {item}
              </span>
              <span className="text-[var(--portal-accent,#D4A574)] opacity-40">
                <Sparkles size={24} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
