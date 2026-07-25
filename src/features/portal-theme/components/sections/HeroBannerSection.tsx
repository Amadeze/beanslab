"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface HeroBannerProps {
  settings: Record<string, unknown>;
  blocks: any[];
  typography?: any;
  layout?: any;
  sectionId: string;
  isPreview?: boolean;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroBannerSection({ settings, typography }: HeroBannerProps) {
  const title = (settings.title as string) || "Welcome";
  const subtitle = (settings.subtitle as string) || "";
  const imageUrl = settings.imageUrl as string | null;
  const buttonText = (settings.buttonText as string) || "";
  const buttonLink = (settings.buttonLink as string) || "#";
  const overlay = (settings.overlay as number) || 55;
  const textAlignment = (settings.textAlignment as string) || "left";
  const reduceMotion = useReducedMotion();

  // Split title on ". " or "\n" for two-line reveal
  const titleParts = title.split(/(?:\. |\n)/);
  const line1 = titleParts[0] || title;
  const line2 = titleParts.slice(1).join(". ");

  return (
    <section className="relative w-full min-h-[90vh] md:min-h-screen flex items-center overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute inset-0 z-0">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "saturate(90%) contrast(104%)" }}
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0,0,0,${overlay / 100})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 78% 28%, color-mix(in srgb, var(--portal-accent, #E9A17F) 12%, transparent), transparent 34%), radial-gradient(circle at 12% 10%, color-mix(in srgb, var(--portal-primary, #B65331) 8%, transparent), transparent 28%), var(--portal-bg, #080B0C)`,
            }}
          />
        )}

        {/* Instrument grid pattern — matching landing page */}
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(var(--portal-secondary,#15B8C6)_1px,transparent_1px),linear-gradient(90deg,var(--portal-secondary,#15B8C6)_1px,transparent_1px)] [background-size:64px_64px]" />

        {/* Ambient scan line — matching landing page */}
        {!reduceMotion && (
          <motion.div
            className="pointer-events-none absolute inset-y-0 z-0 w-40 bg-gradient-to-r from-transparent via-[var(--portal-secondary,#15B8C6)]/[0.04] to-transparent blur-xl"
            animate={{ x: ["-18vw", "112vw"] }}
            transition={{ duration: 8.5, repeat: Infinity, repeatDelay: 1.8, ease: "linear" }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Content */}
      <div
        className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-14 py-16 sm:py-28 md:py-36"
        style={{ textAlign: textAlignment as any }}
      >
        <div className={`grid grid-cols-1 ${imageUrl ? "lg:grid-cols-[minmax(0,.8fr)_minmax(400px,1.2fr)]" : ""} gap-8 sm:gap-12 lg:gap-20 items-center`}>
          {/* Text Column */}
          <div className="space-y-6 sm:space-y-8">
            {/* Decorative line */}
            <motion.div
              initial={reduceMotion ? false : { width: 0 }}
              animate={reduceMotion ? undefined : { width: 48 }}
              transition={{ duration: 1, delay: 0.3, ease }}
              className="h-[1px] bg-[var(--portal-accent,#E9A17F)]"
              style={{ margin: textAlignment === "center" ? "0 auto" : textAlignment === "right" ? "0 0 0 auto" : undefined }}
            />

            {/* Title — text reveal animation matching landing page */}
            <h1
              className="text-[clamp(2.2rem,4.5vw,4rem)] font-black leading-[0.92] tracking-[-0.058em]"
              style={{
                color: imageUrl ? "#fff" : "var(--portal-text, #F8FAFC)",
                fontFamily: typography?.font || "var(--portal-font-heading)",
              }}
            >
              <span className="block overflow-hidden">
                <motion.span
                  className="block"
                  initial={reduceMotion ? false : { y: "110%", rotate: 1.2 }}
                  animate={reduceMotion ? undefined : { y: 0, rotate: 0 }}
                  transition={{ duration: 0.64, delay: 0.14, ease }}
                >
                  {line1}{line2 ? "." : ""}
                </motion.span>
              </span>
              {line2 && (
                <span className="mt-1 block overflow-hidden" style={{ color: imageUrl ? "var(--portal-accent, #E9A17F)" : "var(--portal-primary, #B65331)" }}>
                  <motion.span
                    className="block"
                    initial={reduceMotion ? false : { y: "110%", rotate: 1.2 }}
                    animate={reduceMotion ? undefined : { y: 0, rotate: 0 }}
                    transition={{ duration: 0.64, delay: 0.24, ease }}
                  >
                    {line2}
                  </motion.span>
                </span>
              )}
            </h1>

            {subtitle && (
              <motion.p
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.58, delay: 0.35, ease }}
                className="text-[15px] sm:text-base leading-7 max-w-xl"
                style={{
                  color: imageUrl ? "rgba(255,255,255,0.52)" : "var(--portal-text-muted, #8B95A5)",
                  fontFamily: "var(--portal-font-body)",
                }}
              >
                {subtitle}
              </motion.p>
            )}

            {buttonText && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.58, delay: 0.44, ease }}
                className="flex flex-col gap-3 sm:flex-row pt-2 sm:pt-0"
                style={{ justifyContent: textAlignment === "center" ? "center" : textAlignment === "right" ? "flex-end" : "flex-start" }}
              >
                <motion.div whileHover={reduceMotion ? undefined : { y: -3 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
                  <a
                    href={buttonLink}
                    className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 px-6 text-sm font-black transition-colors"
                    style={{
                      backgroundColor: "var(--portal-primary, #B65331)",
                      color: "#fff",
                    }}
                  >
                    {buttonText}
                    <ArrowRight size={16} strokeWidth={2} />
                  </a>
                </motion.div>
              </motion.div>
            )}

            {/* Mobile trust badges */}
            {imageUrl && (
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
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-md"
                  >
                    <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/60">{item.label}</p>
                    <p className="mt-1 text-xs font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Hero Image */}
          {imageUrl && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.95, x: 40 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 1.2, delay: 0.3, ease }}
              className="hidden lg:block"
            >
              <div className="relative min-h-[440px] overflow-hidden rounded-2xl border border-white/10 bg-black/10">
                <img
                  src={imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ filter: "saturate(90%) contrast(104%)" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 z-10" style={{ background: "linear-gradient(to top, var(--portal-bg, #080B0C), transparent)" }} />
    </section>
  );
}
