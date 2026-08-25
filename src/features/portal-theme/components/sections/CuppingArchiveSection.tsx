"use client";

import { motion } from "framer-motion";
import { Coffee, ShieldAlert, CalendarDays } from "lucide-react";
import { SCA_GRADE_LABEL, scaGrade } from "@/lib/cupping-intelligence";

interface CuppingArchiveProps {
  settings: Record<string, unknown>;
  blocks?: any[];
  cupping?: Array<{
    code: string;
    date: string;
    scaScore: number | null;
    defectCount: number | null;
    lotLabel?: string | null;
  }>;
}

export function CuppingArchiveSection({ settings, blocks, cupping = [] }: CuppingArchiveProps) {
  const title = (settings.title as string) || "Arsip Cupping & Skor Kualitas";
  const subtitle =
    (settings.subtitle as string) ||
    "Setiap batch disensori oleh tim QC. Skor SCA dan catatan defect kami tampilkan terbuka sebagai janji kualitas.";

  // Data asli dari cuppingSession tenant; fallback ke blocks bila diisi manual.
  const items = (cupping && cupping.length > 0 ? cupping : (blocks ?? [])).slice(0, 12);

  return (
    <section className="w-full py-14 sm:py-20 md:py-28" style={{ backgroundColor: "var(--portal-bg, #0B0F19)", color: "var(--portal-text, #F8FAFC)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--portal-accent,#D4A574)]">
            <Coffee size={14} /> Transparansi Kualitas
          </div>
          <h2 className="mt-3 font-heading text-2xl font-black tracking-tight sm:text-4xl md:text-5xl" style={{ fontFamily: "var(--portal-font-heading)" }}>
            {title}
          </h2>
          <p className="mt-3 text-xs leading-relaxed opacity-75 sm:text-base" style={{ fontFamily: "var(--portal-font-body)" }}>
            {subtitle}
          </p>
        </div>

        {items.length === 0 ? (
          <p className="mx-auto mt-10 max-w-md text-center text-sm text-white/50">
            Belum ada hasil cupping yang dipublikasikan.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item: any, index: number) => {
              const score = typeof item.scaScore === "number" ? item.scaScore : null;
              const gradeKey = score != null ? scaGrade(score) : null;
              const grade = gradeKey ? SCA_GRADE_LABEL[gradeKey] : null;
              return (
                <motion.article
                  key={item.code ?? index}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.3) }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">{item.code}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
                        <CalendarDays size={13} />
                        {new Date(item.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className={`rounded-xl px-3 py-1.5 text-right ${grade ? grade.className : "bg-black/40"}`}>
                      <p className="text-[9px] font-bold uppercase opacity-60">SCA</p>
                      <p className="font-black tabular-nums">{score != null ? score.toFixed(1) : "—"}</p>
                    </div>
                  </div>

                  {grade && (
                    <p className={`mt-3 text-xs font-bold uppercase tracking-wide ${grade.className}`}>{grade.label}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
                    {item.defectCount != null && item.defectCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-200">
                        <ShieldAlert size={12} /> {item.defectCount} defect
                      </span>
                    )}
                    {item.lotLabel && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5">Lot {item.lotLabel}</span>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
