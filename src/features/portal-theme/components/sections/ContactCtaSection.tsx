"use client";

import { motion } from "framer-motion";
import { Phone, Mail, MessageCircle, ArrowRight } from "lucide-react";

interface ContactCtaProps {
  settings: Record<string, unknown>;
  typography?: any;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function ContactCtaSection({ settings, typography }: ContactCtaProps) {
  const title = (settings.title as string) || "Get in Touch";
  const text = (settings.text as string) || "";
  const buttonText = (settings.buttonText as string) || "Contact Us";
  const buttonLink = (settings.buttonLink as string) || "#";
  const showPhone = settings.showPhone !== false;
  const showEmail = settings.showEmail !== false;
  const showWhatsApp = settings.showWhatsApp !== false;

  return (
    <section className="w-full" style={{ backgroundColor: "var(--portal-surface-alt, #F5F3EF)" }}>
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
            <span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
              Contact
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
          {text && (
            <p
              className="mb-8 text-base max-w-xl mx-auto leading-[1.75]"
              style={{ color: "var(--portal-text-muted, #6B7280)", fontFamily: "var(--portal-font-body)" }}
            >
              {text}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-4">
            {buttonText && (
              <motion.a
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                href={buttonLink}
                className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold transition-all"
                style={{
                  backgroundColor: "var(--portal-primary, #B65331)",
                  color: "var(--portal-text-inverse, #fff)",
                }}
              >
                {buttonText}
                <ArrowRight size={16} strokeWidth={1.5} />
              </motion.a>
            )}
            {showWhatsApp && (
              <motion.a
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                href="#"
                className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-semibold transition-colors"
                style={{
                  borderColor: "var(--portal-border, #E5E5E5)",
                  color: "var(--portal-text, #1A1A1A)",
                  backgroundColor: "var(--portal-surface, #fff)",
                }}
              >
                <MessageCircle size={16} /> WhatsApp
              </motion.a>
            )}
            {showPhone && (
              <motion.a
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                href="#"
                className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-semibold transition-colors"
                style={{
                  borderColor: "var(--portal-border, #E5E5E5)",
                  color: "var(--portal-text, #1A1A1A)",
                  backgroundColor: "var(--portal-surface, #fff)",
                }}
              >
                <Phone size={16} /> Call Us
              </motion.a>
            )}
            {showEmail && (
              <motion.a
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                href="#"
                className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-semibold transition-colors"
                style={{
                  borderColor: "var(--portal-border, #E5E5E5)",
                  color: "var(--portal-text, #1A1A1A)",
                  backgroundColor: "var(--portal-surface, #fff)",
                }}
              >
                <Mail size={16} /> Email
              </motion.a>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
