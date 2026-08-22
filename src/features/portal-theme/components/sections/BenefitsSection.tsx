"use client";

import { motion } from "framer-motion";
import { Star, Shield, Zap, CheckCircle, Heart, Award, Leaf, Coffee, Truck, Clock } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Star, Shield, Zap, CheckCircle, Heart, Award, Leaf, Coffee, Truck, Clock,
};

const ease = [0.22, 1, 0.36, 1] as const;

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

interface BenefitsProps {
  settings: Record<string, unknown>;
  blocks: any[];
  typography?: any;
  layout?: any;
}

export function BenefitsSection({ settings, blocks, typography }: BenefitsProps) {
  const title = (settings.title as string) || "";
  const subtitle = (settings.subtitle as string) || "";
  const columns = (settings.columns as number) || 3;
  const visibleBlocks = blocks.filter((b) => b.type === "benefit" && b.visible !== false);

  if (visibleBlocks.length === 0) return null;

  return (
    <section className="w-full" style={{ backgroundColor: "var(--portal-surface, #fff)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-28">
        {(title || subtitle) && <motion.div
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
              style={{ color: "var(--portal-text-muted, #6B7280)", fontFamily: "var(--portal-font-body)" }}
            >
              Benefits
            </span>
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
          </div>
          <h2
            className="text-3xl md:text-4xl font-semibold tracking-tight mb-4"
            style={{
              color: "var(--portal-text, #1A1A1A)",
              fontFamily: typography?.font || "var(--portal-font-heading)",
            }}
          >
            {title}
          </h2>
          {subtitle && <p
            className="text-base leading-[1.75]"
            style={{ color: "var(--portal-text-muted, #6B7280)", fontFamily: "var(--portal-font-body)" }}
          >
            {subtitle}
          </p>}
        </motion.div>
        }

        {/* Feature Grid */}
        <div
          className={`grid gap-6 lg:gap-8 ${GRID_COLS[Math.min(columns, visibleBlocks.length)] || GRID_COLS[3]}`}
        >
          {visibleBlocks.map((block, i) => {
            const IconComp = ICON_MAP[block.settings.icon as string] || Star;
            return (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 30, rotate: -1 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.08, ease }}
                whileHover={{ y: -6, transition: { duration: 0.35, ease } }}
                className="group"
              >
                <div
                  className="relative p-7 md:p-8 rounded-[20px] border transition-all duration-500 h-full group-hover:shadow-[0_12px_32px_rgba(107,68,35,0.06)]"
                  style={{
                    backgroundColor: "var(--portal-surface, #fff)",
                    borderColor: "var(--portal-border, #E5E5E5)",
                  }}
                >
                  {/* Icon */}
                  <div
                    className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-5 transition-all duration-400 group-hover:scale-110"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--portal-primary, #B65331) 8%, transparent)",
                      color: "var(--portal-accent, #D4A574)",
                    }}
                  >
                    <IconComp size={20} strokeWidth={1.5} />
                  </div>

                  {/* Content */}
                  <div>
                    <h3
                      className="text-lg font-semibold mb-2"
                      style={{
                        color: "var(--portal-text, #1A1A1A)",
                        fontFamily: typography?.font || "var(--portal-font-heading)",
                      }}
                    >
                      {block.settings.title as string}
                    </h3>
                    <p
                      className="text-sm leading-[1.75]"
                      style={{ color: "var(--portal-text-muted, #6B7280)", fontFamily: "var(--portal-font-body)" }}
                    >
                      {block.settings.description as string}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
