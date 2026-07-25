"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FaqProps {
  settings: Record<string, unknown>;
  blocks: any[];
  typography?: any;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function FaqSection({ settings, blocks, typography }: FaqProps) {
  const title = (settings.title as string) || "FAQ";
  const layout = (settings.layout as string) || "accordion";
  const [openId, setOpenId] = useState<string | null>(null);

  const visibleBlocks = blocks.filter((b) => b.type === "question" && b.visible !== false);
  if (visibleBlocks.length === 0) return null;

  return (
    <section className="w-full" style={{ backgroundColor: "var(--portal-bg, #080B0C)" }}>
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20 md:py-28">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
            <span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
              FAQ
            </span>
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
          </div>
          <h2
            className="text-3xl md:text-4xl font-semibold tracking-tight"
            style={{
              color: "var(--portal-text, #1A1A1A)",
              fontFamily: typography?.font || "var(--portal-font-heading)",
            }}
          >
            {title}
          </h2>
        </motion.div>

        {/* Accordion */}
        <div className="space-y-3">
          {visibleBlocks.map((block, i) => {
            const isOpen = openId === block.id;
            return (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06, ease }}
                className="rounded-2xl border overflow-hidden transition-colors duration-200"
                style={{
                  borderColor: isOpen ? "var(--portal-accent, #D4A574)" : "var(--portal-border, #E5E5E5)",
                  backgroundColor: "var(--portal-surface, #fff)",
                }}
              >
                <button
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                  onClick={() => setOpenId(isOpen ? null : block.id)}
                >
                  <span
                    className="text-sm font-semibold pr-4"
                    style={{ color: "var(--portal-text, #1A1A1A)" }}
                  >
                    {block.settings.question as string}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease }}
                  >
                    <ChevronDown size={18} style={{ color: "var(--portal-text-muted, #6B7280)" }} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease }}
                      className="overflow-hidden"
                    >
                      <div
                        className="px-6 pb-5 text-sm leading-[1.8]"
                        style={{ color: "var(--portal-text-muted, #6B7280)" }}
                      >
                        {block.settings.answer as string}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
