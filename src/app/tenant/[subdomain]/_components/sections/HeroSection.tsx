"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";
import { ThemeSkin } from "../themes/ThemeSkin";

interface HeroSectionProps {
  heroText: string;
  aboutText: string;
  bgImage: string;
  waLink: string;
  skin: ThemeSkin;
}

export function HeroSection({ heroText, aboutText, bgImage, waLink, skin }: HeroSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);
  }, [bgImage]);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <motion.section
      ref={ref}
      className="relative w-full min-h-[90vh] md:min-h-screen flex items-center overflow-hidden"
    >
      {/* Theme-aware atmosphere */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle at 78% 28%, color-mix(in srgb, var(--t-accent) 17%, transparent), transparent 34%), radial-gradient(circle at 12% 10%, color-mix(in srgb, var(--t-primary) 11%, transparent), transparent 28%), var(--t-bg)",
          }}
        />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(var(--t-border)_1px,transparent_1px),linear-gradient(90deg,var(--t-border)_1px,transparent_1px)] [background-size:64px_64px]" />
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ opacity }}
        className="relative z-10 w-full max-w-[1500px] mx-auto px-5 sm:px-8 lg:px-14 py-28 md:py-36"
      >
        <div className={`grid grid-cols-1 ${bgImage ? "lg:grid-cols-[minmax(0,.8fr)_minmax(400px,1.2fr)]" : ""} gap-12 lg:gap-20 items-center`}>
          {/* Text Column */}
          <div className="space-y-8">
            {/* Decorative thin line */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 48 }}
              transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="h-[1px] bg-[var(--t-accent)]"
            />

            {skin.heroBadge && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {skin.heroBadge}
              </motion.div>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="text-[clamp(2.2rem,4.5vw,4rem)] font-black tracking-[-0.058em] leading-[0.92] text-[var(--t-text)]"
              style={{ fontFamily: "var(--t-font-display)" }}
            >
              {heroText}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="text-[15px] md:text-base text-[var(--t-text-muted)] leading-7 max-w-xl"
              style={{ fontFamily: "var(--t-font-body)" }}
            >
              {aboutText}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-wrap gap-4"
            >
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}
                className={`flex items-center gap-2 text-sm ${skin.buttonPrimaryClass}`}
                style={{ fontFamily: "var(--t-font-body)" }}
              >
                Explore Our Collection
                <ArrowRight size={16} strokeWidth={1.5} />
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-medium ${skin.buttonSecondaryClass}`}
                style={{ fontFamily: "var(--t-font-body)" }}
              >
                <MessageCircle size={16} strokeWidth={1.5} />
                Get in Touch
              </motion.a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.42 }}
              className="grid grid-cols-3 gap-2 pt-2 lg:hidden"
            >
              {[
                { label: "Origin", value: "Traceable" },
                { label: "Roast", value: "Profiled" },
                { label: "Supply", value: "Reliable" },
              ].map((item) => (
                <div key={item.label} className="rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-surface)] p-3">
                  <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--t-text-muted)]">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--t-text)]">{item.value}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <div className={`relative min-h-[440px] overflow-hidden border border-[var(--t-border)] bg-[var(--t-surface)] ${skin.heroImageClass}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--t-accent)_22%,transparent),transparent_58%)]" />
              {bgImage && !imageFailed ? (
                <img
                  src={bgImage}
                  alt="Specialty coffee selection"
                  width={1200}
                  height={900}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  style={{ filter: "saturate(90%) contrast(104%)" }}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(var(--t-border)_1px,transparent_1px),linear-gradient(90deg,var(--t-border)_1px,transparent_1px)] [background-size:42px_42px]" />
                  <div className="relative h-56 w-40 rotate-[18deg] rounded-[48%_52%_46%_54%/58%_55%_45%_42%] bg-[var(--t-primary)] shadow-[var(--t-shadow-xl)]">
                    <div className="absolute left-1/2 top-4 h-48 w-7 -translate-x-1/2 rotate-[-8deg] rounded-[50%] border-l-2 border-[var(--t-bg)]/45" />
                  </div>
                  <div className="absolute right-7 top-20 max-w-36 rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-bg)]/80 p-3 shadow-[var(--t-shadow-md)] backdrop-blur-md">
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--t-text-muted)]">Lot passport</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--t-text)]">Single origin</p>
                    <p className="mt-1 text-[10px] text-[var(--t-text-muted)]">Traceable · Seasonal</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
              <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
                Roasted to order
              </div>
              <div className="absolute inset-x-5 bottom-5 grid grid-cols-3 gap-2 rounded-[calc(var(--t-radius)+4px)] border border-white/15 bg-black/35 p-4 text-white backdrop-blur-xl">
                {[
                  { label: "Traceable", value: "Origin" },
                  { label: "Profiled", value: "Roast" },
                  { label: "Reliable", value: "Supply" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/50">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 z-10" style={{ background: "linear-gradient(to top, var(--t-bg), transparent)" }} />
    </motion.section>
  );
}
