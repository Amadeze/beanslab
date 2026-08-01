"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Menu, X } from "lucide-react";
import { TenantBrand } from "../themes/TenantBrand";
import { ThemeSkin } from "../themes/ThemeSkin";
import type { Tenant } from "@prisma/client";
import type { CartStore } from "../themes/ThemeProps";

interface HeaderSectionProps {
  tenant: Tenant;
  cart: CartStore;
  setIsCartOpen: (open: boolean) => void;
  skin: ThemeSkin;
  showTestimonials?: boolean;
  mounted?: boolean;
}

export function HeaderSection({ tenant, cart, setIsCartOpen, skin, showTestimonials = false, mounted = false }: HeaderSectionProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const totalItems = mounted ? cart.getTotalItems(tenant.subdomain || "") : 0;
  const navigationItems = [
    { id: "catalog", label: "Our Collection" },
    ...(showTestimonials ? [{ id: "testimonials", label: "Stories" }] : []),
    { id: "faq", label: "FAQ" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-500 ${scrolled ? "backdrop-blur-xl" : "border-transparent"}`}
      style={{
        backgroundColor: scrolled ? "color-mix(in srgb, var(--t-bg) 92%, transparent)" : "transparent",
        borderColor: scrolled ? "var(--t-border)" : "transparent",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="text-lg md:text-xl font-semibold tracking-tight"
              style={{ fontFamily: "'Playfair Display', 'Source Serif 4', Georgia, serif" }}
            >
              <TenantBrand tenant={tenant} fallback={tenant.name || "Roastery Portal"} />
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="px-4 py-2 text-sm font-medium text-[var(--t-text-muted)] hover:text-[var(--t-text)] transition-colors duration-300 rounded-[var(--t-radius)] hover:bg-[var(--t-surface)]"
                style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsCartOpen(true)}
              className={`relative flex items-center gap-2 text-sm ${skin.buttonPrimaryClass}`}
            >
              <ShoppingBag size={15} strokeWidth={1.5} />
              <span className="hidden sm:inline">Cart</span>
              <AnimatePresence>
                {totalItems > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center text-xs font-medium rounded-full bg-[var(--t-accent)] text-[var(--t-bg)] shadow-md"
                  >
                    {totalItems}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-[var(--t-radius)] text-[var(--t-text-muted)] hover:text-[var(--t-text)] transition-colors duration-300"
            >
              {mobileMenuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden overflow-hidden backdrop-blur-md border-b border-[var(--t-border)] bg-[var(--t-bg)]"
          >
            <nav className="px-5 py-5 space-y-1">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-[var(--t-text-muted)] hover:text-[var(--t-text)] rounded-[var(--t-radius)] hover:bg-[var(--t-surface)] transition-colors duration-300"
                  style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
