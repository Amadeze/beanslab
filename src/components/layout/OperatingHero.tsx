import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type OperatingStage =
  "inventory" | "roasting" | "production" | "sales" | "finance";

interface OperatingHeroMetric {
  label: string;
  value: ReactNode;
}

interface OperatingHeroProps {
  stage: OperatingStage;
  headline: ReactNode;
  description: ReactNode;
  signalLabel?: string;
  signalValue: ReactNode;
  signalTone?: "critical" | "ready" | "neutral";
  metrics: OperatingHeroMetric[];
  next?: {
    label: string;
    href: string;
  };
}

const stageNumber: Record<OperatingStage, string> = {
  inventory: "01",
  roasting: "02",
  production: "03",
  sales: "04",
  finance: "05",
};

const stageTone: Record<
  OperatingStage,
  { eyebrow: string; line: string; aside: string; ready: string; link: string }
> = {
  inventory: {
    eyebrow: "text-[#2B7567]",
    line: "bg-[#2B7567]",
    aside: "bg-[#16352F]",
    ready: "text-[#8CD1C1]",
    link: "text-[#9AD7C8]",
  },
  roasting: {
    eyebrow: "text-[#984024]",
    line: "bg-[#B65331]",
    aside: "bg-[#3A1C13]",
    ready: "text-[#E9A17F]",
    link: "text-[#F0AC8C]",
  },
  production: {
    eyebrow: "text-[#89570C]",
    line: "bg-[#A66F12]",
    aside: "bg-[#382A11]",
    ready: "text-[#E0BC67]",
    link: "text-[#E7C778]",
  },
  sales: {
    eyebrow: "text-[#6F4A6A]",
    line: "bg-[#6F4A6A]",
    aside: "bg-[#2E202D]",
    ready: "text-[#C7A8C4]",
    link: "text-[#D2B5CF]",
  },
  finance: {
    eyebrow: "text-[#4B6B3C]",
    line: "bg-[#4B6B3C]",
    aside: "bg-[#202C1B]",
    ready: "text-[#A8C390]",
    link: "text-[#B7CE9F]",
  },
};

export function OperatingHero({
  stage,
  headline,
  description,
  signalLabel = "Status lini",
  signalValue,
  signalTone = "neutral",
  metrics,
  next,
}: OperatingHeroProps) {
  const tone = stageTone[stage];
  const signalColor = {
    critical: "text-[#FF8C88]",
    ready: tone.ready,
    neutral: "text-white",
  }[signalTone];

  return (
    <section className="instrument-grid border-b border-border bg-background">
      <div className="mx-auto grid w-full max-w-[1600px] lg:grid-cols-[minmax(0,1fr)_minmax(560px,0.82fr)]">
        <div className="flex min-w-0 flex-col justify-center px-4 py-4 sm:px-6 lg:px-8">
          <div className="mb-2 flex items-center gap-3">
            <span
              className={cn(
                "font-mono text-[10px] font-bold uppercase tracking-[0.22em]",
                tone.eyebrow,
              )}
            >
              {stageNumber[stage]} / Fokus operasi
            </span>
            <span className={cn("h-px w-10", tone.line)} aria-hidden />
          </div>
          <h2 className="max-w-[900px] text-[clamp(1.25rem,1.85vw,1.8rem)] font-black leading-[1.04] tracking-[-0.04em] text-foreground">
            {headline}
          </h2>
          <div className="mt-1.5 line-clamp-1 max-w-[860px] text-xs leading-5 text-muted-foreground sm:text-[13px]">
            {description}
          </div>
        </div>

        <aside
          className={cn(
            "instrument-grid-dark grid grid-cols-[110px_minmax(0,1fr)] border-t border-black/20 px-4 py-3 text-white sm:grid-cols-[minmax(135px,0.48fr)_minmax(0,1.52fr)] sm:px-6 sm:py-4 lg:border-l lg:border-t-0 lg:px-5",
            tone.aside,
          )}
        >
          <div className="flex min-w-0 flex-col justify-between border-r border-white/10 pr-3 sm:pr-4">
            <div>
              <p className="font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-white/38">
                {signalLabel}
              </p>
              <div
                className={`mt-1.5 text-[clamp(1.45rem,2vw,1.85rem)] font-black leading-none tracking-[-0.045em] ${signalColor}`}
              >
                {signalValue}
              </div>
            </div>

            {next && (
              <Link
                href={next.href}
                className={cn(
                  "mt-2.5 inline-flex min-h-6 items-center gap-2 text-[10px] font-bold transition-[color,gap] hover:gap-3 hover:text-white",
                  tone.link,
                )}
              >
                <span className="hidden sm:inline">{next.label}</span>
                <span className="sm:hidden">Lanjut</span>
                <ArrowRight size={13} />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 pl-3 sm:grid-cols-4 sm:pl-4">
            {metrics.slice(0, 4).map((metric, index) => (
              <div
                key={metric.label}
                className={cn(
                  "flex min-w-0 flex-col justify-center px-2 py-2 first:pl-0 last:pr-0",
                  index % 2 === 0 && "border-r border-white/10",
                  index % 2 === 1 &&
                    index < 3 &&
                    "sm:border-r sm:border-white/10",
                  index > 1 && "border-t border-white/10 sm:border-t-0",
                )}
              >
                <p className="truncate font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-white/32">
                  {metric.label}
                </p>
                <div className="mt-1 truncate text-[13px] font-bold tabular-nums text-white/90">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
