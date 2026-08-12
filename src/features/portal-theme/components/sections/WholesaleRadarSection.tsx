"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Sliders, TrendingDown, DollarSign, Package, ShieldCheck, Check } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

interface WholesaleRadarProps {
  settings: Record<string, unknown>;
  blocks: any[];
}

const DEFAULT_PROFILES = [
  {
    id: "prof-1",
    name: "Espresso Master Blend (70/30)",
    roast: "Medium-Dark",
    acidity: 40,
    body: 95,
    sweetness: 85,
    balance: 90,
    aftertaste: 88,
    basePrice: 16.50,
    description: "Designed for commercial espresso machines. Cuts through milk effortlessly with intense dark chocolate and caramel notes."
  },
  {
    id: "prof-2",
    name: "Single Origin Gayo Anaerobic",
    roast: "Light-Medium",
    acidity: 90,
    body: 70,
    sweetness: 92,
    balance: 85,
    aftertaste: 85,
    basePrice: 22.00,
    description: "Vibrant competition filter or modern espresso profile. Bursting with passion fruit, bergamot, and wild honey sweetness."
  },
  {
    id: "prof-3",
    name: "House Daily Blend (100% Arabica)",
    roast: "Medium",
    acidity: 60,
    body: 80,
    sweetness: 80,
    balance: 95,
    aftertaste: 82,
    basePrice: 14.50,
    description: "The crowd-pleasing workhorse for high-volume cafes and hotel breakfast bars. Smooth, sweet, and nutty."
  }
];

const TIERS = [
  { kg: 5, discount: 0, label: "Sample / Micro Batch" },
  { kg: 25, discount: 0.10, label: "Cafe Partner (10% OFF)" },
  { kg: 50, discount: 0.18, label: "Multi-Branch (18% OFF)" },
  { kg: 100, discount: 0.25, label: "Distributor Contract (25% OFF)" },
];

export function WholesaleRadarSection({ settings, blocks }: WholesaleRadarProps) {
  const title = (settings.title as string) || "Wholesale Roast Profile Matrix & Tier Pricing";
  const subtitle = (settings.subtitle as string) || "Analyze sensory cupping attributes and simulate volume-based contract discounts in real time.";
  
  const [selectedProfIndex, setSelectedProfIndex] = useState(0);
  const [selectedTierIndex, setSelectedTierIndex] = useState(1); // Default 25kg

  const visibleBlocks = blocks.filter(b => b.visible !== false);
  const profiles = visibleBlocks.length > 0 ? visibleBlocks.map((b, i) => ({
    id: b.id || `prof-${i}`,
    name: b.settings?.title as string || `Profile ${i + 1}`,
    roast: b.settings?.subtitle as string || "Medium Roast",
    acidity: Number(b.settings?.acidity || 70),
    body: Number(b.settings?.body || 80),
    sweetness: Number(b.settings?.sweetness || 85),
    balance: Number(b.settings?.balance || 90),
    aftertaste: Number(b.settings?.aftertaste || 80),
    basePrice: Number(b.settings?.basePrice || 16.50),
    description: b.settings?.content as string || "High quality roasted coffee beans for wholesale partners."
  })) : DEFAULT_PROFILES;

  const currentProf = profiles[selectedProfIndex] || profiles[0];
  const currentTier = TIERS[selectedTierIndex] || TIERS[1];
  const discountedPrice = (currentProf.basePrice * (1 - currentTier.discount)).toFixed(2);
  const totalContract = (Number(discountedPrice) * currentTier.kg).toFixed(2);
  const savings = ((currentProf.basePrice * currentTier.discount) * currentTier.kg).toFixed(2);

  return (
    <section className="w-full py-12 sm:py-20 md:py-28" style={{ backgroundColor: "var(--portal-bg, #0B0F19)", color: "var(--portal-text, #F8FAFC)" }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-[var(--portal-accent,#D4A574)]/15 border border-[var(--portal-accent,#D4A574)]/30 text-[var(--portal-accent,#D4A574)] mb-4">
            <Sliders size={14} /> Sensory Data Viz & Pricing
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-4" style={{ fontFamily: "var(--portal-font-heading)" }}>
            {title}
          </h2>
          <p className="text-sm sm:text-base opacity-75 leading-relaxed" style={{ fontFamily: "var(--portal-font-body)" }}>
            {subtitle}
          </p>
        </div>

        {/* Matrix Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Profile Selectors & Sensory Bars (7 cols) */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            
            {/* Profile Selector Tabs */}
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3">
              {profiles.map((prof, idx) => {
                const isSelected = selectedProfIndex === idx;
                return (
                  <button
                    key={prof.id}
                    onClick={() => setSelectedProfIndex(idx)}
                    className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left border transition-all duration-300 relative overflow-hidden ${
                      isSelected 
                        ? "bg-white/10 border-[var(--portal-accent,#D4A574)] shadow-xl scale-[1.02]" 
                        : "bg-white/[0.02] border-white/10 hover:bg-white/5 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider block mb-0.5 sm:mb-1 text-[var(--portal-accent,#D4A574)]">
                      {prof.roast}
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-white line-clamp-1">
                      {prof.name}
                    </h4>
                    {isSelected && (
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[var(--portal-accent,#D4A574)] text-black flex items-center justify-center">
                        <Check size={10} className="stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sensory Cupping Metrics Box */}
            <motion.div 
              key={currentProf.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
              className="p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl space-y-5 sm:space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-xl font-black text-white">{currentProf.name}</h3>
                  <p className="text-xs text-white/60 mt-1">{currentProf.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs uppercase text-white/50 block">Base Wholesale</span>
                  <span className="text-lg font-black text-[var(--portal-accent,#D4A574)]">${currentProf.basePrice.toFixed(2)}/kg</span>
                </div>
              </div>

              {/* Attributes Bars */}
              <div className="space-y-4">
                {[
                  { label: "Acidity & Brightness", val: currentProf.acidity, color: "#F97316" },
                  { label: "Body & Mouthfeel", val: currentProf.body, color: "#D4A574" },
                  { label: "Sweetness & Caramel", val: currentProf.sweetness, color: "#10B981" },
                  { label: "Overall Balance", val: currentProf.balance, color: "#8B5CF6" },
                  { label: "Clean Aftertaste", val: currentProf.aftertaste, color: "#3B82F6" },
                ].map((attr, idx) => (
                  <div key={attr.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                      <span className="text-white/80">{attr.label}</span>
                      <span className="font-mono text-white">{attr.val}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-black/40 overflow-hidden p-0.5 border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${attr.val}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1, ease }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: attr.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>

          {/* Right Column: Wholesale Tier Volume Simulator (5 cols) */}
          <div className="lg:col-span-5">
            <div className="p-6 sm:p-8 rounded-3xl border border-white/15 bg-slate-900 shadow-2xl space-y-6 sticky top-28">
              <div className="flex items-center gap-2 pb-4 border-b border-white/10 text-white">
                <Package className="text-[var(--portal-accent,#D4A574)]" size={20} />
                <h3 className="text-lg font-black uppercase tracking-wider">Volume Contract Simulator</h3>
              </div>

              {/* Tier Selection Buttons */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-white/70 block mb-1">
                  Select Monthly Order Volume Tier:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {TIERS.map((tier, idx) => {
                    const isSel = selectedTierIndex === idx;
                    return (
                      <button
                        key={tier.kg}
                        onClick={() => setSelectedTierIndex(idx)}
                        className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                          isSel 
                            ? "bg-[var(--portal-accent,#D4A574)] text-black border-[var(--portal-accent,#D4A574)] font-black shadow-lg" 
                            : "bg-white/5 text-white border-white/10 hover:bg-white/10 font-bold"
                        }`}
                      >
                        <span className="text-sm">{tier.kg} kg / mo</span>
                        <span className={`text-xs uppercase mt-1 ${isSel ? "text-black/75" : "text-white/50"}`}>
                          {tier.discount > 0 ? `${(tier.discount * 100)}% Discount` : "Standard Rate"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price Calculation Box */}
              <div className="p-5 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Contract Rate per kg:</span>
                  <span className="text-xl font-black font-mono text-[var(--portal-accent,#D4A574)]">
                    ${discountedPrice}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Monthly Volume:</span>
                  <span className="font-bold text-white font-mono">{currentTier.kg} kg</span>
                </div>
                {Number(savings) > 0 && (
                  <div className="flex justify-between items-center text-xs text-emerald-400 font-bold bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/30">
                    <span className="flex items-center gap-1"><TrendingDown size={14} /> Partner Savings:</span>
                    <span>-${savings} / month</span>
                  </div>
                )}
                <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                  <span className="text-xs font-bold uppercase text-white/60">Total Estimated Contract:</span>
                  <span className="text-2xl font-black text-white font-mono">${totalContract}</span>
                </div>
              </div>

              {/* Action Button */}
              <button 
                onClick={() => {
                  const el = document.getElementById("catalog") || document.getElementById("contact");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full py-4 rounded-2xl bg-[var(--portal-accent,#D4A574)] hover:bg-[var(--portal-accent,#D4A574)]/90 text-black font-black text-sm uppercase tracking-widest transition-all duration-300 shadow-xl flex items-center justify-center gap-2"
              >
                <span>Request Wholesale Sample & Contract</span>
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-white/50">
                <ShieldCheck size={14} className="text-[var(--portal-accent,#D4A574)]" />
                <span>Price locked for 6 months • Free SCA barista training included</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
