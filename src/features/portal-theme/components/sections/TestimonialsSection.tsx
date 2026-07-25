"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

interface TestimonialsProps {
  settings: Record<string, unknown>;
  blocks: any[];
  typography?: any;
}

export function TestimonialsSection({ settings, blocks, typography }: TestimonialsProps) {
  const columns = (settings.columns as number) || 3;
  const showRating = settings.showRating !== false;
  const visibleBlocks = blocks.filter((b) => b.type === "testimonial" && b.visible !== false);

  if (visibleBlocks.length === 0) return null;

  return (
    <section className="w-full" style={{ backgroundColor: "var(--portal-surface-alt, #F5F3EF)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-28">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
            <span
              className="text-[11px] font-medium uppercase tracking-[0.2em]"
              style={{ color: "var(--portal-text-muted, #6B7280)" }}
            >
              Testimonials
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
            What Our Partners Say
          </h2>
        </motion.div>

        {/* Testimonial Grid */}
        <div
          className={`grid gap-6 ${GRID_COLS[Math.min(columns, visibleBlocks.length)] || GRID_COLS[3]}`}
        >
          {visibleBlocks.map((block, i) => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.1, ease }}
              whileHover={{ y: -4, transition: { duration: 0.3 } }}
              className="relative rounded-2xl p-6 md:p-8 border transition-all duration-300"
              style={{
                backgroundColor: "var(--portal-surface, #fff)",
                borderColor: "var(--portal-border-subtle, #F0F0F0)",
              }}
            >
              {/* Quote icon */}
              <div className="mb-4">
                <Quote
                  size={28}
                  strokeWidth={1}
                  style={{ color: "var(--portal-accent, #D4A574)", opacity: 0.4 }}
                />
              </div>

              {showRating && block.settings.rating && (
                <div className="mb-3 flex gap-1">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      size={14}
                      fill={idx < (block.settings.rating as number) ? "var(--portal-primary, #B65331)" : "none"}
                      style={{ color: "var(--portal-primary, #B65331)" }}
                    />
                  ))}
                </div>
              )}

              <p
                className="mb-6 text-sm leading-[1.8] italic"
                style={{ color: "var(--portal-text, #1A1A1A)" }}
              >
                &ldquo;{block.settings.text as string}&rdquo;
              </p>

              <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--portal-border-subtle, #F0F0F0)" }}>
                {block.settings.avatar ? (
                  <img
                    src={block.settings.avatar as string}
                    alt={block.settings.name as string}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--portal-primary, #B65331) 10%, transparent)",
                      color: "var(--portal-primary, #B65331)",
                    }}
                  >
                    {(block.settings.name as string)?.charAt(0) || "?"}
                  </div>
                )}
                <div>
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--portal-text, #1A1A1A)" }}
                  >
                    {block.settings.name as string}
                  </div>
                  {block.settings.role && (
                    <div className="text-xs" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
                      {block.settings.role as string}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
