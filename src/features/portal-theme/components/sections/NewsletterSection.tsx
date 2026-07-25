"use client";

import { motion } from "framer-motion";
import { Send } from "lucide-react";

interface NewsletterProps {
  settings: Record<string, unknown>;
  typography?: any;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function NewsletterSection({ settings, typography }: NewsletterProps) {
  const title = (settings.title as string) || "Stay Updated";
  const subtitle = (settings.subtitle as string) || "";
  const placeholder = (settings.placeholder as string) || "Enter your email";
  const buttonText = (settings.buttonText as string) || "Subscribe";
  const privacyText = (settings.privacyText as string) || "";

  return (
    <section className="w-full" style={{ backgroundColor: "var(--portal-surface, #fff)" }}>
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="text-center rounded-3xl p-10 md:p-14 border"
          style={{
            backgroundColor: "var(--portal-surface-alt, #F5F3EF)",
            borderColor: "var(--portal-border-subtle, #F0F0F0)",
          }}
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
            <span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
              Newsletter
            </span>
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
          </div>

          {title && (
            <h2
              className="text-3xl md:text-4xl font-semibold tracking-tight mb-3"
              style={{
                color: "var(--portal-text, #1A1A1A)",
                fontFamily: typography?.font || "var(--portal-font-heading)",
              }}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              className="mb-8 text-base max-w-md mx-auto"
              style={{ color: "var(--portal-text-muted, #6B7280)", fontFamily: "var(--portal-font-body)" }}
            >
              {subtitle}
            </p>
          )}

          <form className="flex max-w-md mx-auto flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder={placeholder}
              className="flex-1 rounded-xl border px-5 py-3.5 text-sm outline-none focus:ring-2 transition-shadow"
              style={{
                borderColor: "var(--portal-border, #E5E5E5)",
                backgroundColor: "var(--portal-surface, #fff)",
                color: "var(--portal-text, #1A1A1A)",
              }}
            />
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all"
              style={{
                backgroundColor: "var(--portal-primary, #B65331)",
                color: "var(--portal-text-inverse, #fff)",
              }}
            >
              <Send size={14} />
              {buttonText}
            </motion.button>
          </form>

          {privacyText && (
            <p className="mt-4 text-xs" style={{ color: "var(--portal-text-muted, #6B7280)", opacity: 0.7 }}>
              {privacyText}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
