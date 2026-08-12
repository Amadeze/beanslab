"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, X, HelpCircle } from "lucide-react";
import { ThemeSkin } from "../themes/ThemeSkin";

interface FaqSectionProps {
  faqs: { question: string; answer: string }[];
  skin: ThemeSkin;
}

export function FaqSection({ faqs, skin }: FaqSectionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const q = searchQuery.toLowerCase();
    return faqs.filter(
      faq =>
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q)
    );
  }, [faqs, searchQuery]);

  return (
    <section id="faq" className="w-full bg-[var(--t-surface)]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20 md:py-28">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-[1px] bg-[var(--t-accent)]" />
            <span
              className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--t-text-muted)]"
              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
            >
              Common Questions
            </span>
            <div className="w-12 h-[1px] bg-[var(--t-accent)]" />
          </div>
          <h2
            className="text-3xl md:text-4xl font-semibold tracking-tight text-[var(--t-text)]"
            style={{ fontFamily: "'Playfair Display', 'Source Serif 4', Georgia, serif" }}
          >
            We Love Questions
          </h2>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8"
        >
          <div className="relative">
            <Search size={16} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--t-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for answers..."
              className="w-full pl-11 pr-10 py-3.5 text-base rounded-2xl bg-[var(--t-bg)] border border-[var(--t-border)] text-[var(--t-text)] placeholder:text-[var(--t-text-muted)]/50 focus:outline-none focus:border-[var(--t-accent)] focus:ring-1 focus:ring-[#c8956c]/20 transition-all duration-300"
              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--t-text-muted)] hover:text-[var(--t-text)] transition-colors"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </motion.div>

        {/* Accordion */}
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-14 rounded-[20px] border-2 border-dashed border-[var(--t-border)]">
              <HelpCircle size={36} strokeWidth={1} className="mx-auto mb-3 opacity-20 text-[var(--t-text-muted)]" />
              <p
                className="text-sm text-[var(--t-text-muted)]"
                style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
              >
                No matching questions found.
              </p>
            </div>
          ) : (
            filteredFaqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.2), ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className={`rounded-[16px] border transition-all duration-400 ${
                      isOpen
                        ? "border-l-[3px] border-l-[#6b4423] border-t-[#e8e0d8] border-r-[#e8e0d8] border-b-[#e8e0d8] bg-[var(--t-surface)] shadow-[0_4px_16px_rgba(44,36,32,0.04)]"
                        : "border-[var(--t-border)] bg-[var(--t-bg)] hover:border-[var(--t-accent)]/30 hover:bg-[var(--t-surface)]"
                    }`}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between p-5 md:p-6 text-left"
                    >
                      <span
                        className="font-semibold text-sm md:text-base text-[var(--t-text)] pr-4"
                        style={{ fontFamily: "'Playfair Display', 'Source Serif 4', Georgia, serif" }}
                      >
                        {faq.question}
                      </span>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                          isOpen ? "bg-[var(--t-primary)]/10 text-[var(--t-primary)]" : "text-[var(--t-text-muted)]"
                        }`}
                      >
                        <ChevronDown size={16} strokeWidth={1.5} />
                      </motion.div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 md:px-6 pb-5 md:pb-6">
                            <div className="w-8 h-[1px] bg-[#e8e0d8] mb-5" />
                            <p
                              className="text-sm text-[var(--t-text-muted)] leading-[1.8]"
                              style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
                            >
                              {faq.answer}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
