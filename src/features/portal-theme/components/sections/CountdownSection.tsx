"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface CountdownProps {
  settings: Record<string, unknown>;
  typography?: any;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function CountdownSection({ settings, typography }: CountdownProps) {
  const title = (settings.title as string) || "Limited Time Offer";
  const subtitle = (settings.subtitle as string) || "";
  const targetDate = (settings.targetDate as string) || "";
  const expiredText = (settings.expiredText as string) || "Offer has expired";
  const style = (settings.style as string) || "boxes";

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setExpired(true); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) return null;

  const units = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <section className="w-full" style={{ backgroundColor: "var(--portal-surface, #fff)" }}>
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20 md:py-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-[1px] bg-[var(--portal-accent, #D4A574)]" />
            <span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
              Limited Time
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
            <p className="mb-10 text-base" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
              {subtitle}
            </p>
          )}

          {expired ? (
            <p className="text-lg font-semibold" style={{ color: "var(--portal-text-muted, #6B7280)" }}>
              {expiredText}
            </p>
          ) : style === "boxes" ? (
            <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
              {units.map((u, i) => (
                <motion.div
                  key={u.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease }}
                  className="flex flex-col items-center rounded-2xl px-4 py-4 sm:px-5 sm:py-5 min-w-[70px] sm:min-w-[80px] border"
                  style={{
                    backgroundColor: "var(--portal-surface-alt, #F5F3EF)",
                    borderColor: "var(--portal-border-subtle, #F0F0F0)",
                  }}
                >
                  <span
                    className="text-3xl font-bold tabular-nums"
                    style={{ color: "var(--portal-primary, #B65331)" }}
                  >
                    {String(u.value).padStart(2, "0")}
                  </span>
                  <span
                    className="mt-1 text-[10px] uppercase tracking-[0.14em] font-medium"
                    style={{ color: "var(--portal-text-muted, #6B7280)" }}
                  >
                    {u.label}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--portal-primary, #B65331)" }}>
              {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
