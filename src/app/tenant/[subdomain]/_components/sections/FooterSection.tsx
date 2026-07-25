"use client";

import React from "react";
import { motion } from "framer-motion";
import { Globe, Mail, ArrowRight } from "lucide-react";
import { TenantBrand } from "../themes/TenantBrand";
import { ThemeSkin } from "../themes/ThemeSkin";
import type { Tenant } from "@prisma/client";

interface FooterSectionProps {
  tenant: Tenant;
  footerText: string;
  igLink: string | null;
  emailLink: string | null;
  skin: ThemeSkin;
  showTestimonials?: boolean;
}

export function FooterSection({ tenant, footerText, igLink, emailLink, skin, showTestimonials = false }: FooterSectionProps) {
  const navigationItems = [
    { id: "catalog", label: "Our Collection" },
    ...(showTestimonials ? [{ id: "testimonials", label: "Stories" }] : []),
    { id: "faq", label: "FAQ" },
  ];

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="w-full bg-[#2c2420]"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        {/* Main Footer Content */}
        <div className="py-16 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
            {/* Brand Column */}
            <div className="lg:col-span-2 space-y-5">
              <div
                className="text-xl font-semibold text-white"
                style={{ fontFamily: "'Playfair Display', 'Source Serif 4', Georgia, serif" }}
              >
                <TenantBrand tenant={tenant} fallback={tenant.name || "Roastery Portal"} />
              </div>
              <p
                className="text-sm text-[var(--t-accent)]/50 leading-[1.75] max-w-sm"
                style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
              >
                {footerText}
              </p>

              {/* Social Links */}
              <div className="flex gap-3">
                {igLink && (
                  <motion.a
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    href={igLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-2xl border border-white/10 flex items-center justify-center text-[var(--t-accent)]/40 hover:text-[var(--t-accent)] hover:border-[var(--t-accent)]/30 transition-all duration-300"
                  >
                    <Globe size={16} strokeWidth={1.5} />
                  </motion.a>
                )}
                {emailLink && (
                  <motion.a
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    href={emailLink}
                    className="w-10 h-10 rounded-2xl border border-white/10 flex items-center justify-center text-[var(--t-accent)]/40 hover:text-[var(--t-accent)] hover:border-[var(--t-accent)]/30 transition-all duration-300"
                  >
                    <Mail size={16} strokeWidth={1.5} />
                  </motion.a>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-5">
              <h4
                className="font-medium text-[11px] text-[var(--t-accent)]/40 uppercase tracking-[0.2em]"
                style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
              >
                Navigate
              </h4>
              <nav className="space-y-3">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" })}
                    className="block text-sm text-[var(--t-accent)]/50 hover:text-white transition-colors duration-300"
                    style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Contact CTA */}
            <div className="space-y-5">
              <h4
                className="font-medium text-[11px] text-[var(--t-accent)]/40 uppercase tracking-[0.2em]"
                style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
              >
                Wholesale Inquiries
              </h4>
              <p
                className="text-xs text-[var(--t-accent)]/40 leading-[1.7]"
                style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
              >
                Need a recurring supply plan, custom roast profile, or help choosing the right coffee for your menu?
              </p>
              <a
                href={emailLink || "#catalog"}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:border-[var(--t-accent)]/35 hover:text-[var(--t-accent)]"
              >
                {emailLink ? "Email our team" : "Browse the collection"}
                <ArrowRight size={14} strokeWidth={1.5} />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p
              className="text-xs text-[var(--t-accent)]/30"
              style={{ fontFamily: "'Playfair Display', 'Source Serif 4', Georgia, serif" }}
            >
              &copy; {new Date().getFullYear()} {tenant.name || "Roastery Portal"}. Crafted with care.
            </p>
            <p
              className="text-xs text-[var(--t-accent)]/30"
              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
            >
              Powered by <span className="font-medium text-[var(--t-accent)]/50">roastd.id</span>
            </p>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
