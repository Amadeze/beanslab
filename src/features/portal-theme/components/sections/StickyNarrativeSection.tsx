"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, CheckCircle2, ShieldCheck, Flame, Cpu, Globe, ArrowRight, Coffee } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  CheckCircle2, ShieldCheck, Flame, Cpu, Globe, Sparkles
};

const ease = [0.22, 1, 0.36, 1] as const;

interface StickyNarrativeProps {
  settings: Record<string, unknown>;
  blocks: any[];
}

export function StickyNarrativeSection({ settings, blocks }: StickyNarrativeProps) {
  const title = (settings.title as string) || "";
  const subtitle = (settings.subtitle as string) || "";
  const pinnedTitle = (settings.pinnedTitle as string) || "Proses kami";
  const pinnedSubtitle = (settings.pinnedSubtitle as string) || "";

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const visibleBlocks = blocks.filter((b) => b.visible !== false);
  const displaySteps = visibleBlocks.map((b, i) => ({
    id: b.id || `step-${i}`,
    stepNumber: `0${i + 1}`.slice(-2),
    title: b.settings?.title as string || `Step ${i + 1}`,
    subtitle: b.settings?.subtitle as string || "",
    content: b.settings?.content as string || "",
    image: b.settings?.imageUrl as string || "",
    icon: b.settings?.icon as string || "CheckCircle2",
    tag: b.settings?.tag as string || ""
  }));

  if (displaySteps.length === 0) return null;

  const currentStep = displaySteps[activeStepIndex] || displaySteps[0];

  return (
    <section className="w-full py-12 sm:py-24 md:py-32" style={{ backgroundColor: "var(--portal-bg, #0F172A)", color: "var(--portal-text, #F8FAFC)" }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-[var(--portal-accent,#D4A574)]/15 border border-[var(--portal-accent,#D4A574)]/30 text-[var(--portal-accent,#D4A574)] mb-4">
            <Sparkles size={14} /> Narasi Split Persisten
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-4" style={{ fontFamily: "var(--portal-font-heading)" }}>
            {title}
          </h2>
          <p className="text-sm sm:text-base opacity-75 leading-relaxed" style={{ fontFamily: "var(--portal-font-body)" }}>
            {subtitle}
          </p>
        </div>

        {/* Split Screen Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-20 items-start">

          {/* Left Column: Sticky Pinned Visual Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 z-20">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease }}
              className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 bg-slate-900 shadow-2xl aspect-[16/9] sm:aspect-[1/1] lg:aspect-[4/5] flex flex-col justify-end p-5 sm:p-8 group"
            >
              {currentStep.image ? (
                <img
                  src={currentStep.image}
                  alt={currentStep.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                  <Coffee size={64} className="text-white/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

              {/* Top Pill */}
              <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 flex items-center justify-between gap-2 sm:gap-3 z-10">
                <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white">
                  <span className="block text-xs font-extrabold uppercase tracking-wider">{pinnedTitle}</span>
                  {pinnedSubtitle && (
                    <span className="mt-0.5 block text-[10px] text-white/60">{pinnedSubtitle}</span>
                  )}
                </div>
                <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-[var(--portal-accent,#D4A574)] text-black text-xs sm:text-xs font-black uppercase tracking-widest shadow-lg">
                  {currentStep.stepNumber} / {displaySteps.length < 10 ? `0${displaySteps.length}` : displaySteps.length}
                </div>
              </div>

              {/* Bottom Pinned Info */}
              <div className="relative z-10">
                <span className="text-xs sm:text-xs font-extrabold uppercase tracking-widest text-[var(--portal-accent,#D4A574)] block mb-0.5 sm:mb-1">
                  {currentStep.tag}
                </span>
                <h3 className="text-base sm:text-2xl font-black text-white leading-snug">
                  {currentStep.title}
                </h3>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Scrolling Steps Narrative */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-12 py-2 sm:py-4">
            {displaySteps.map((step, idx) => {
              const IconComp = ICON_MAP[step.icon] || CheckCircle2;
              const isActive = activeStepIndex === idx;

              return (
                <motion.div
                  key={step.id}
                  onViewportEnter={() => setActiveStepIndex(idx)}
                  viewport={{ margin: "-30% 0px -30% 0px" }}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`p-5 sm:p-8 rounded-2xl sm:rounded-3xl border transition-all duration-500 cursor-pointer ${
                    isActive
                      ? "bg-white/10 border-[var(--portal-accent,#D4A574)]/60 shadow-2xl scale-[1.01] sm:scale-[1.02] backdrop-blur-xl"
                      : "bg-white/[0.02] border-white/5 opacity-60 hover:opacity-90 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span className="text-xl sm:text-3xl font-black font-mono text-[var(--portal-accent,#D4A574)]">
                        {step.stepNumber}
                      </span>
                      <div>
                        <h4 className="text-base sm:text-xl font-bold tracking-tight text-white leading-snug">
                          {step.title}
                        </h4>
                        {step.subtitle && (
                          <span className="text-xs sm:text-xs font-semibold uppercase tracking-wider text-white/60 block mt-0.5">
                            {step.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
                      isActive
                        ? "bg-[var(--portal-accent,#D4A574)] text-black border-[var(--portal-accent,#D4A574)] shadow-lg"
                        : "bg-white/5 text-white/40 border-white/10"
                    }`}>
                      <IconComp className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-white/75 leading-relaxed pl-1">
                    {step.content}
                  </p>

                  {isActive && (
                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[var(--portal-accent,#D4A574)] uppercase tracking-wider">
                      <span>Langkah Aktif Ditampilkan di Kiri</span>
                      <ArrowRight size={14} className="animate-pulse" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}
