"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Coffee, Globe, Mail, ArrowRight, ShieldCheck, Activity, Phone, MapPin, Sparkles } from "lucide-react";

interface FooterNavProps {
  settings: Record<string, unknown>;
  isPreview?: boolean;
}

export function FooterNavSection({ settings, isPreview = false }: FooterNavProps) {
  const styleMode = (settings.styleMode as string) || "editorial_grid";
  const logoText = (settings.logoText as string) || "ROASTD.ID";
  const bioText = (settings.bioText as string) || "Empowering specialty coffee roasters and B2B cafe partners with precision telemetry, micro-batch profiling, and direct-trade sourcing.";
  const copyrightText = (settings.copyrightText as string) || "© 2026 ROASTD.ID • Roastery Operating System. All rights reserved.";
  
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
    }
  };

  const navLinks = [
    { label: "Whole Bean Catalog", href: "#catalog" },
    { label: "Sensory Flavor Explorer", href: "#matrix" },
    { label: "Roasting Process & Narrative", href: "#narrative" },
    { label: "Wholesale Tiers & FAQ", href: "#faq" },
  ];

  // ── 1. EDITORIAL GRID (4-Column Luxury Grid) ─────────────────────────────────
  if (styleMode === "editorial_grid") {
    return (
      <footer className="w-full bg-slate-950 text-slate-300 border-t border-white/10 pt-16 pb-12 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 sm:gap-12 pb-16 border-b border-white/10">
          
          {/* Brand & Bio (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[var(--portal-accent,#D4A574)] flex items-center justify-center text-black font-black">
                <Coffee size={16} className="stroke-[2.5]" />
              </div>
              <span className="text-xl font-black text-white font-mono tracking-tight">{logoText}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm font-sans">
              {bioText}
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-[var(--portal-accent,#D4A574)] font-bold">
              <ShieldCheck size={16} />
              <span>100% Guaranteed Extraction Consistency</span>
            </div>
          </div>

          {/* Quick Links (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-white/90">Navigation</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-slate-400 hover:text-[var(--portal-accent,#D4A574)] transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Wholesale Hours & Origin (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-white/90">Operations</h4>
            <div className="space-y-2 text-xs text-slate-400 font-sans">
              <p className="font-semibold text-slate-300">Roasting Days:</p>
              <p>Every Tuesday & Thursday</p>
              <p className="font-semibold text-slate-300 pt-2">Support Hours:</p>
              <p>Mon - Fri, 08:00 - 18:00 WIB</p>
            </div>
          </div>

          {/* Newsletter (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-white/90">B2B Telemetry Dispatch</h4>
            <p className="text-xs text-slate-400">Get weekly harvest reports and micro-lot arrival alerts directly to your cafe inbox.</p>
            {subscribed ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center">
                ✨ Subscribed to Weekly Dispatch!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2 pt-1">
                <input
                  type="email"
                  placeholder="cafe@domain.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--portal-accent,#D4A574)]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--portal-accent,#D4A574)] text-black font-black text-xs uppercase hover:bg-white transition-colors shrink-0"
                >
                  Join
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="max-w-7xl mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>{copyrightText}</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-400 transition-colors">Wholesale SLA</a>
            <a href="#" className="hover:text-slate-400 transition-colors">System Security</a>
          </div>
        </div>
      </footer>
    );
  }

  // ── 2. BRUTALIST MONO (Giant Typography & High Contrast) ─────────────────────
  if (styleMode === "brutalist_mono") {
    return (
      <footer className="w-full bg-black text-white border-t-4 border-white font-mono overflow-hidden">
        {/* Giant Ticker Brand */}
        <div className="py-12 sm:py-20 px-4 sm:px-8 border-b-4 border-white text-center sm:text-left bg-[var(--portal-accent,#D4A574)] text-black">
          <h2 className="text-4xl sm:text-7xl md:text-8xl font-black uppercase tracking-tighter leading-none break-words">
            {logoText} | WHOLESALE
          </h2>
          <p className="text-sm sm:text-xl font-bold uppercase tracking-widest mt-4">
            PRECISION ROASTING ENGINE FOR B2B PARTNERS
          </p>
        </div>

        {/* Links & Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-b-4 border-white divide-y md:divide-y-0 md:divide-x-4 divide-white text-sm">
          <div className="p-6 sm:p-10 space-y-4">
            <span className="bg-white text-black px-2 py-0.5 text-xs font-black uppercase">01 — ABOUT</span>
            <p className="text-white/80 leading-relaxed">{bioText}</p>
          </div>

          <div className="p-6 sm:p-10 space-y-4">
            <span className="bg-white text-black px-2 py-0.5 text-xs font-black uppercase">02 — INDEX</span>
            <ul className="space-y-3 font-bold text-base">
              {navLinks.map((link, i) => (
                <li key={link.label}>
                  <a href={link.href} className="hover:text-[var(--portal-accent,#D4A574)] block">
                    &gt; 0{i+1}. {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 sm:p-10 space-y-4 flex flex-col justify-between">
            <div>
              <span className="bg-white text-black px-2 py-0.5 text-xs font-black uppercase">03 — DISPATCH</span>
              <p className="text-white/80 mt-3">DIRECT TRADE TRACEABILITY & SYSTEM METRICS ONLINE.</p>
            </div>
            <div className="pt-6">
              <a href="#catalog" className="inline-block w-full text-center py-4 bg-white text-black font-black uppercase hover:bg-[var(--portal-accent,#D4A574)] transition-colors text-base border-2 border-black">
                ACCESS B2B PORTAL NOW &rarr;
              </a>
            </div>
          </div>
        </div>

        {/* Brutalist Copyright */}
        <div className="p-6 text-center text-xs font-black tracking-widest uppercase bg-black text-white/60">
          {copyrightText}
        </div>
      </footer>
    );
  }

  // ── 3. MINIMAL CENTERED (Clean Centered Capsule) ─────────────────────────────
  if (styleMode === "minimal_centered") {
    return (
      <footer className="w-full bg-[#1A1817] text-[#E5DFD7] border-t border-white/10 py-16 sm:py-24 px-6 text-center font-sans">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--portal-accent,#D4A574)]/15 text-[var(--portal-accent,#D4A574)] mb-2">
            <Coffee size={24} />
          </div>

          <h3 className="text-2xl sm:text-4xl font-bold tracking-tight font-serif text-white">
            {logoText}
          </h3>

          <p className="text-sm text-[#A8A096] leading-relaxed max-w-xl mx-auto font-light">
            {bioText}
          </p>

          <div className="flex flex-wrap justify-center gap-6 text-xs font-semibold uppercase tracking-widest pt-4">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="text-[#E5DFD7]/70 hover:text-[var(--portal-accent,#D4A574)] transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <div className="w-24 h-px bg-white/10 mx-auto my-8" />

          <p className="text-xs text-[#A8A096]/60 tracking-wider">
            {copyrightText}
          </p>
        </div>
      </footer>
    );
  }

  // ── 4. CYBER TERMINAL (OLED System Status Footer) ────────────────────────────
  return (
    <footer className="w-full bg-[#05070D] text-[#00FF66] border-t border-[#00FF66]/30 font-mono text-xs py-12 px-6 shadow-[0_-10px_40px_rgba(0,255,102,0.08)]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 border-b border-[#00FF66]/20">
        
        {/* Terminal Status (5 cols) */}
        <div className="md:col-span-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-white">
            <Activity size={18} className="text-[#00FF66] animate-pulse" />
            <span>{logoText} | TERMINAL SUBSYSTEM</span>
          </div>
          <div className="p-4 rounded bg-[#00FF66]/5 border border-[#00FF66]/25 space-y-2 text-[11px] text-[#00FF66]/90">
            <div className="flex justify-between">
              <span>SERVER CLUSTER:</span>
              <span className="font-bold text-white">ROAST-CORE-01 (TOKYO/JKT)</span>
            </div>
            <div className="flex justify-between">
              <span>TELEMETRY SYNC:</span>
              <span className="font-bold text-[#00FF66]">LIVE | 100% UPTIME</span>
            </div>
            <div className="flex justify-between">
              <span>SECURITY PROTOCOL:</span>
              <span className="font-bold text-white">AES-256 B2B ENCRYPTED</span>
            </div>
          </div>
          <p className="text-[11px] text-white/50 leading-relaxed">
            {bioText}
          </p>
        </div>

        {/* Matrix Links (4 cols) */}
        <div className="md:col-span-4 space-y-3">
          <span className="text-[11px] font-black uppercase text-white tracking-widest block border-b border-[#00FF66]/20 pb-2">
            INDEX_DIRECTORIES
          </span>
          <ul className="space-y-2 text-xs">
            {navLinks.map((link, idx) => (
              <li key={link.label}>
                <a href={link.href} className="text-[#00FF66]/70 hover:text-white hover:underline flex items-center gap-2">
                  <span className="text-white/40">[0{idx+1}]</span>
                  <span>{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* System Command (3 cols) */}
        <div className="md:col-span-3 space-y-3">
          <span className="text-[11px] font-black uppercase text-white tracking-widest block border-b border-[#00FF66]/20 pb-2">
            EXECUTE_ORDER
          </span>
          <p className="text-[11px] text-white/60">Ready to instantiate monthly recurring wholesale contract?</p>
          <a
            href="#catalog"
            className="block text-center py-3 rounded bg-[#00FF66] text-black font-black uppercase tracking-wider hover:bg-white transition-all shadow-[0_0_15px_rgba(0,255,102,0.4)]"
          >
            LAUNCH PORTAL &rarr;
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/40">
        <p>{copyrightText}</p>
        <div className="flex items-center gap-4 text-[#00FF66]/60">
          <span>STATUS: ONLINE 🟢</span>
          <span>BUILD: v2026.4-LTS</span>
        </div>
      </div>
    </footer>
  );
}
