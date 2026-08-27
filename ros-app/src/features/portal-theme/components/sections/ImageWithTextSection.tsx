"use client";

import { motion } from "framer-motion";
import { StorefrontImage } from "../StorefrontImage";

interface ImageWithTextProps {
  settings: Record<string, unknown>;
  typography?: any;
  layout?: any;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function ImageWithTextSection({ settings, typography }: ImageWithTextProps) {
  const imageUrl = settings.imageUrl as string | null;
  const title = (settings.title as string) || "";
  const text = (settings.text as string) || "";
  const alignment = (settings.alignment as string) || "left";
  const isReversed = alignment === "right";

  return (
    <section className="w-full" style={{ backgroundColor: "var(--portal-bg, #FAFAF8)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-28">
        <div className={`flex flex-col gap-12 items-center ${isReversed ? "md:flex-row-reverse" : "md:flex-row"}`}>
          {imageUrl && (
            <motion.div
              initial={{ opacity: 0, x: isReversed ? 40 : -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.9, ease }}
              className="w-full md:w-1/2"
            >
              <div className="relative overflow-hidden rounded-2xl border" style={{ borderColor: "var(--portal-border-subtle, #F0F0F0)" }}>
                <StorefrontImage
                  src={imageUrl}
                  alt={title || ""}
                  width={1000}
                  height={750}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="w-full h-auto object-cover"
                  style={{ aspectRatio: (settings.aspectRatio as string) || "16/9" }}
                />
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, delay: 0.15, ease }}
            className="w-full md:w-1/2"
          >
            {title && (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
                    Details
                  </span>
                </div>
                <h2
                  className="text-3xl md:text-4xl font-semibold tracking-tight mb-6"
                  style={{
                    color: "var(--portal-text, #1A1A1A)",
                    fontFamily: typography?.font || "var(--portal-font-heading)",
                  }}
                >
                  {title}
                </h2>
              </>
            )}
            {text && (
              <p
                className="text-base leading-[1.85] whitespace-pre-wrap"
                style={{ color: "var(--portal-text-muted, #6B7280)", fontFamily: "var(--portal-font-body)" }}
              >
                {text}
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
