"use client";

import { motion } from "framer-motion";
import { Expand } from "lucide-react";

interface GalleryProps {
  settings: Record<string, unknown>;
  blocks: any[];
  typography?: any;
}

const ease = [0.22, 1, 0.36, 1] as const;

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function GallerySection({ settings, blocks }: GalleryProps) {
  const columns = (settings.columns as number) || 3;
  const visibleBlocks = blocks.filter((b) => b.type === "image" && b.visible !== false);

  if (visibleBlocks.length === 0) return null;

  return (
    <section className="w-full" style={{ backgroundColor: "var(--portal-bg, #FAFAF8)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-28">
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
              Gallery
            </span>
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
          </div>
        </motion.div>

        <div
          className={`grid gap-3 ${GRID_COLS[Math.min(columns, 4)] || GRID_COLS[3]}`}
        >
          {visibleBlocks.map((block, i) => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08, ease }}
              whileHover={{ scale: 1.02 }}
              className="group relative overflow-hidden rounded-xl cursor-pointer"
            >
              {block.settings.imageUrl && (
                <img
                  src={block.settings.imageUrl as string}
                  alt={(block.settings.caption as string) || ""}
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              )}
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
              >
                <Expand size={24} className="text-white" />
              </div>
              {block.settings.caption && (
                <div
                  className="absolute bottom-0 left-0 right-0 px-3 py-2.5 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
                >
                  {block.settings.caption as string}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
