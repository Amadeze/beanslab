"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertTriangle, ShieldAlert, Info, ChevronDown, RefreshCw } from "lucide-react";
import {
  summarizeInsights,
  type CopilotInsight,
  type CopilotDomain,
  type CopilotSeverity,
} from "@/lib/roastery-intelligence";
import { generateCopilotNarrative } from "../copilot-actions";

const DOMAIN_LABEL: Record<CopilotDomain, string> = {
  lot: "Lot",
  batch: "Batch",
  cupping: "Cupping",
  inventory: "Inventori",
};

const SEVERITY_STYLE: Record<CopilotSeverity, { icon: typeof Info; tone: string; chip: string; ring: string }> = {
  critical: {
    icon: ShieldAlert,
    tone: "text-red-300",
    chip: "bg-red-500/15 text-red-200 border-red-400/30",
    ring: "border-red-400/30",
  },
  attention: {
    icon: AlertTriangle,
    tone: "text-amber-200",
    chip: "bg-amber-500/15 text-amber-100 border-amber-400/30",
    ring: "border-amber-400/25",
  },
  info: {
    icon: Info,
    tone: "text-sky-200",
    chip: "bg-sky-500/15 text-sky-100 border-sky-400/30",
    ring: "border-sky-400/25",
  },
};

export function RoasteryCopilot({ insights }: { insights: CopilotInsight[] }) {
  const [open, setOpen] = useState(false);
  const [narrative, setNarrative] = useState<{ text: string; source: "deterministic" | "llm" } | null>(null);
  const [loadingNarrative, setLoadingNarrative] = useState(false);

  const summary = summarizeInsights(insights);
  const criticalCount = insights.filter((i) => i.severity === "critical").length;
  const attentionCount = insights.filter((i) => i.severity === "attention").length;

  async function handleNarrative() {
    setLoadingNarrative(true);
    setNarrative(null);
    try {
      const result = await generateCopilotNarrative(insights);
      setNarrative(result);
    } finally {
      setLoadingNarrative(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-domain-roasting/[0.04] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-domain-roasting/15 text-domain-roasting">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-domain-roasting">Roastery Copilot</p>
            <h2 className="font-heading text-base font-bold tracking-[-0.03em]">Sinyal operasional hari ini</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-red-200">{criticalCount} kritis</span>
          )}
          {attentionCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-100">{attentionCount} perhatian</span>
          )}
          {insights.length === 0 && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-200">Stabil</span>}
        </div>
      </div>

      {insights.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Tidak ada sinyal yang butuh tindakan. Kualitas &amp; stok dalam batas normal.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {insights.slice(0, 8).map((insight) => {
            const style = SEVERITY_STYLE[insight.severity];
            const Icon = style.icon;
            return (
              <li
                key={insight.id}
                className={`flex items-start gap-3 rounded-xl border ${style.ring} bg-card/60 p-3`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.tone}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.chip}`}>
                      {DOMAIN_LABEL[insight.domain]}
                    </span>
                    {insight.metric && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                        {insight.metric}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
                  {insight.action && (
                    <Link
                      href={insight.action.href}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-domain-roasting hover:underline"
                    >
                      {insight.action.label} →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          Ringkasan AI
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-foreground/80">{summary}</p>
              <button
                type="button"
                onClick={handleNarrative}
                disabled={loadingNarrative}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:border-domain-roasting/40 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingNarrative ? "animate-spin" : ""}`} />
                {loadingNarrative ? "Membuat narasi…" : "Tulis narasi (LLM lokal)"}
              </button>
              {narrative && (
                <p className="mt-2 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground/80">
                  <span className="mb-1 block font-bold uppercase tracking-wide text-[10px] text-muted-foreground">
                    {narrative.source === "llm" ? "Narasi LLM lokal" : "Narasi deterministik (gratis)"}
                  </span>
                  {narrative.text}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
