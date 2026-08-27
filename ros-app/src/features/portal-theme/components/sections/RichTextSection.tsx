"use client";

import { motion } from "framer-motion";

interface RichTextProps {
  settings: Record<string, unknown>;
  typography?: any;
  layout?: any;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function RichTextSection({ settings, typography }: RichTextProps) {
  const title = (settings.title as string) || "";
  const content = (settings.content as string) || "";
  const alignment = (settings.alignment as string) || "left";

  return (
    <section className="w-full" style={{ backgroundColor: "var(--portal-bg, #FAFAF8)" }}>
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-20 md:py-28" style={{ textAlign: alignment as any }}>
        {title && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease }}
          >
            <div
              className="flex items-center gap-4 mb-6"
              style={{ justifyContent: alignment === "center" ? "center" : alignment === "right" ? "flex-end" : "flex-start" }}
            >
              <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
              <span
                className="text-[11px] font-medium uppercase tracking-[0.2em]"
                style={{ color: "var(--portal-text-muted, #6B7280)" }}
              >
                About Us
              </span>
              <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
            </div>
            <h2
              className="text-3xl md:text-4xl font-semibold tracking-tight mb-8"
              style={{
                color: "var(--portal-text, #1A1A1A)",
                fontFamily: typography?.font || "var(--portal-font-heading)",
              }}
            >
              {title}
            </h2>
          </motion.div>
        )}
        {content && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.15, ease }}
            className="text-base leading-[1.85] whitespace-pre-wrap max-w-3xl"
            style={{
              color: "var(--portal-text-muted, #6B7280)",
              fontFamily: "var(--portal-font-body)",
              marginLeft: alignment === "center" ? "auto" : undefined,
              marginRight: alignment === "right" || alignment === "center" ? "auto" : undefined,
            }}
          >
            {content}
          </motion.div>
        )}
      </div>
    </section>
  );
}
