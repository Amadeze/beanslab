"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CuppingCategory } from "@prisma/client";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Coffee,
  Droplets,
  MapPin,
  Sparkles,
  Sprout,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import { StandardPageLayout } from "@/components/StandardPageLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NextAction } from "@/components/ui/next-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createCuppingSession,
  getCuppingFormOptions,
  getCuppingSessions,
  type CuppingSessionRow,
} from "./actions";
import { computeScaTotal, scaGrade, SCA_GRADE_LABEL } from "@/lib/cupping-intelligence";

type ScoreDefinition = {
  key: CuppingCategory;
  label: string;
  shortLabel: string;
  hint: string;
};

type ScoreGroup = {
  title: string;
  eyebrow: string;
  description: string;
  scores: ScoreDefinition[];
};

const SCORE_GROUPS: ScoreGroup[] = [
  {
    title: "Aroma",
    eyebrow: "01 · sebelum tegukan",
    description: "Nilai kesan aromatik saat bubuk masih kering dan setelah diseduh.",
    scores: [
      { key: "FRAGRANCE", label: "Fragrance", shortLabel: "Fragrance", hint: "Aroma kering" },
      { key: "AROMA", label: "Aroma", shortLabel: "Aroma", hint: "Aroma saat crust pecah" },
    ],
  },
  {
    title: "Karakter cangkir",
    eyebrow: "02 · saat dicicip",
    description: "Bentuk rasa utama, tekstur, kejernihan, dan hubungan antarelemen.",
    scores: [
      { key: "FLAVOR", label: "Flavor", shortLabel: "Flavor", hint: "Kualitas rasa utama" },
      { key: "AFTERTASTE", label: "Aftertaste", shortLabel: "Aftertaste", hint: "Kesan setelah ditelan" },
      { key: "ACIDITY", label: "Acidity", shortLabel: "Acidity", hint: "Kecerahan dan struktur asam" },
      { key: "BODY", label: "Body", shortLabel: "Body", hint: "Bobot dan tekstur" },
      { key: "BALANCE", label: "Balance", shortLabel: "Balance", hint: "Keseimbangan keseluruhan" },
      { key: "OVERALL", label: "Overall", shortLabel: "Overall", hint: "Kesan personal evaluator" },
    ],
  },
  {
    title: "Kebersihan & konsistensi",
    eyebrow: "03 · validasi sampel",
    description: "Pastikan cangkir seragam, bersih, dan memiliki kemanisan yang utuh.",
    scores: [
      { key: "UNIFORMITY", label: "Uniformity", shortLabel: "Uniformity", hint: "Keseragaman antar-cangkir" },
      { key: "CLEAN_CUP", label: "Clean cup", shortLabel: "Clean", hint: "Bebas rasa mengganggu" },
      { key: "SWEETNESS", label: "Sweetness", shortLabel: "Sweetness", hint: "Kemanisan alami" },
    ],
  },
];

const SCORE_DEFINITIONS = SCORE_GROUPS.flatMap((group) => group.scores);
const DEFAULT_SCORES = Object.fromEntries(
  SCORE_DEFINITIONS.map((score) => [score.key, 7.5]),
) as Record<CuppingCategory, number>;

const DESCRIPTORS = [
  "Floral",
  "Citrus",
  "Stone fruit",
  "Tropical",
  "Berry",
  "Chocolate",
  "Caramel",
  "Nutty",
  "Spice",
  "Tea-like",
  "Fermented",
  "Roasty",
];

const RADAR_KEYS: CuppingCategory[] = [
  "FRAGRANCE",
  "FLAVOR",
  "AFTERTASTE",
  "ACIDITY",
  "BODY",
  "BALANCE",
  "SWEETNESS",
  "OVERALL",
];

function qualityBand(average: number) {
  if (average >= 8.5) return { label: "Istimewa", tone: "text-[var(--status-success)]", surface: "bg-[var(--status-success)]" };
  if (average >= 8) return { label: "Menonjol", tone: "text-[var(--status-success)]", surface: "bg-[var(--status-success)]" };
  if (average >= 7) return { label: "Solid", tone: "text-domain-roasting", surface: "bg-domain-roasting" };
  if (average >= 6) return { label: "Perlu perhatian", tone: "text-[var(--status-warning)]", surface: "bg-[var(--status-warning)]" };
  return { label: "Evaluasi ulang", tone: "text-[var(--status-danger)]", surface: "bg-[var(--status-danger)]" };
}

function scoreCopy(score: number) {
  if (score >= 9) return "Luar biasa";
  if (score >= 8) return "Menonjol";
  if (score >= 7) return "Baik";
  if (score >= 6) return "Cukup";
  return "Perlu dikaji";
}

function ScoreSlider({
  definition,
  value,
  onChange,
}: {
  definition: ScoreDefinition;
  value: number;
  onChange: (value: number) => void;
}) {
  const fill = `${value * 10}%`;
  return (
    <div className="group rounded-xl border border-border/70 bg-card/75 px-4 py-3.5 transition-colors hover:border-domain-roasting/35 hover:bg-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={`score-${definition.key}`} className="text-sm font-semibold tracking-[-0.01em]">
            {definition.label}
          </Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{definition.hint}</p>
        </div>
        <div className="min-w-16 rounded-lg border border-domain-roasting/20 bg-domain-roasting/8 px-2.5 py-1 text-right">
          <span className="font-mono text-base font-bold tabular-nums text-domain-roasting">{value.toFixed(2)}</span>
        </div>
      </div>
      <input
        id={`score-${definition.key}`}
        name={`score-${definition.key}`}
        type="range"
        min={0}
        max={10}
        step={0.25}
        value={value}
        aria-label={`${definition.label}: ${value.toFixed(2)} dari 10`}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          background: `linear-gradient(90deg, var(--domain-roasting) 0%, var(--domain-roasting) ${fill}, color-mix(in srgb, var(--border) 78%, transparent) ${fill}, color-mix(in srgb, var(--border) 78%, transparent) 100%)`,
        }}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-domain-roasting [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-domain-roasting [&::-webkit-slider-thumb]:shadow-md"
      />
      <div className="mt-2 flex items-center justify-between text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
        <span>Flat</span>
        <span className="normal-case tracking-normal text-muted-foreground">{scoreCopy(value)}</span>
        <span>Exceptional</span>
      </div>
    </div>
  );
}

function SensoryMap({ scores }: { scores: Record<CuppingCategory, number> }) {
  const center = 120;
  const radius = 78;
  const point = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / RADAR_KEYS.length;
    return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
  };
  const dataPoints = RADAR_KEYS.map((key, index) => point(index, scores[key] / 10)).join(" ");

  return (
    <svg viewBox="0 0 240 240" role="img" aria-label="Peta profil sensorik saat ini" className="mx-auto h-auto w-full max-w-64 overflow-visible">
      <defs>
        <linearGradient id="sensory-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--domain-roasting)" stopOpacity="0.48" />
          <stop offset="1" stopColor="var(--verdigris)" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {[0.4, 0.6, 0.8, 1].map((scale) => (
        <polygon
          key={scale}
          points={RADAR_KEYS.map((_, index) => point(index, scale)).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={scale === 1 ? 0.22 : 0.1}
          strokeWidth="1"
        />
      ))}
      {RADAR_KEYS.map((_, index) => {
        const [x2, y2] = point(index, 1).split(",");
        return <line key={index} x1={center} y1={center} x2={x2} y2={y2} stroke="currentColor" strokeOpacity="0.1" />;
      })}
      <polygon points={dataPoints} fill="url(#sensory-fill)" stroke="var(--domain-roasting)" strokeWidth="2" strokeLinejoin="round" />
      {RADAR_KEYS.map((key, index) => {
        const [x, y] = point(index, scores[key] / 10).split(",").map(Number);
        const [labelX, labelY] = point(index, 1.18).split(",").map(Number);
        const label = SCORE_DEFINITIONS.find((item) => item.key === key)?.shortLabel ?? key;
        return (
          <g key={key}>
            <circle cx={x} cy={y} r="3.5" fill="var(--domain-roasting)" stroke="var(--background)" strokeWidth="2" />
            <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[8px] font-semibold">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ScoreDial({ average }: { average: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, average / 10));
  const band = qualityBand(average);
  return (
    <div className="relative mx-auto h-28 w-28">
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--domain-roasting)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-bold tracking-[-0.06em] tabular-nums">{average.toFixed(2)}</span>
        <span className={`text-xs font-bold uppercase tracking-[0.13em] ${band.tone}`}>{band.label}</span>
      </div>
    </div>
  );
}

function HistoryCard({ session }: { session: CuppingSessionRow }) {
  const average = session.rawMax > 0 ? (session.rawScore / session.rawMax) * 10 : 0;
  const band = qualityBand(average);
  return (
    <article className="group rounded-xl border border-border/75 bg-card/70 p-4 transition-all hover:-translate-y-0.5 hover:border-domain-roasting/30 hover:shadow-sm motion-reduce:transform-none">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{session.code}</p>
          <h3 className="mt-1 truncate font-heading text-base font-bold tracking-[-0.03em]">
            {session.batchCode ?? session.productName ?? "Sampel cupping"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(session.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            {session.evaluatorName ? ` · ${session.evaluatorName}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-heading text-2xl font-bold tracking-[-0.05em] tabular-nums">{average.toFixed(2)}</p>
          <p className={`text-[9px] font-bold uppercase tracking-[0.12em] ${band.tone}`}>{band.label}</p>
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${band.surface}`} style={{ width: `${Math.min(100, average * 10)}%` }} />
      </div>
      {session.notes && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{session.notes}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span>{session.location || "Lokasi tidak dicatat"}</span>
          {session.batchId ? (
            <Link
              href={`/roasting/batch/${session.batchId}`}
              className="inline-flex items-center gap-1 rounded-full border border-domain-roasting/25 bg-domain-roasting/8 px-2 py-0.5 font-semibold text-domain-roasting transition-colors hover:bg-domain-roasting/15"
            >
              Batch <ChevronRight className="h-3 w-3" />
            </Link>
          ) : null}
          {session.lotId ? (
            <Link
              href={`/inventory/lots/${session.lotId}`}
              className="inline-flex items-center gap-1 rounded-full border border-domain-inventory/25 bg-domain-inventory/8 px-2 py-0.5 font-semibold text-domain-inventory transition-colors hover:bg-domain-inventory/15"
            >
              Lot <ChevronRight className="h-3 w-3" />
            </Link>
          ) : null}
          {session.batchId ? (
            <NextAction label="Produce" tone="production" href="/produksi?mulai=1" size="sm" className="h-7 px-2" />
          ) : null}
        </div>
        <span className="inline-flex items-center gap-1 font-semibold text-foreground/70">
          {session.scaScore != null ? `SCA ${session.scaScore}` : `Total ${session.rawScore.toFixed(1)}`}
          <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </article>
  );
}

export default function CuppingPage() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sampleMode, setSampleMode] = useState<"batch" | "product">("batch");
  const [batchId, setBatchId] = useState("");
  const [productId, setProductId] = useState("");
  const [lotId, setLotId] = useState("");
  const [defectCount, setDefectCount] = useState("");
  const [scores, setScores] = useState<Record<CuppingCategory, number>>({ ...DEFAULT_SCORES });
  const [descriptors, setDescriptors] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [options, setOptions] = useState<Awaited<ReturnType<typeof getCuppingFormOptions>>>({ batches: [], products: [], lots: [] });
  const [sessions, setSessions] = useState<CuppingSessionRow[]>([]);
  const [cuppingDate, setCuppingDate] = useState("");
  useEffect(() => {
    setCuppingDate(new Date().toISOString().slice(0, 10));
  }, []);

  const totalScore = useMemo(
    () => SCORE_DEFINITIONS.reduce((sum, definition) => sum + scores[definition.key], 0),
    [scores],
  );
  const averageScore = totalScore / SCORE_DEFINITIONS.length;

  // Komposit SCA live (AI deterministik): Fragrance+Aroma digabung, defect −2/defect.
  const parsedDefects = Number(defectCount);
  const liveScaScore = useMemo(
    () => computeScaTotal(scores, Number.isInteger(parsedDefects) && parsedDefects >= 0 ? parsedDefects : 0),
    [scores, parsedDefects],
  );

  async function refreshData() {
    const [nextOptions, nextSessions] = await Promise.all([
      getCuppingFormOptions(),
      getCuppingSessions(),
    ]);
    setOptions(nextOptions);
    setSessions(nextSessions);
  }

  useEffect(() => {
    void refreshData();
  }, []);

  // Deep-link prefill: /cupping?batchId=… / ?lotId=… (from roasting/batch recap, lot trace)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qBatch = sp.get("batchId");
    const qLot = sp.get("lotId");
    if (qBatch && options.batches.some((batch) => batch.id === qBatch)) {
      setSampleMode("batch");
      setBatchId(qBatch);
    }
    if (qLot && options.lots.some((lot) => lot.id === qLot)) {
      setLotId(qLot);
    }
  }, [options]);

  function toggleDescriptor(descriptor: string) {
    setDescriptors((current) =>
      current.includes(descriptor)
        ? current.filter((item) => item !== descriptor)
        : [...current, descriptor],
    );
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setMessage(null);

    const selectedBatchId = sampleMode === "batch" ? batchId : "";
    const selectedProductId = sampleMode === "product" ? productId : "";
    if (!selectedBatchId && !selectedProductId) {
      setSubmitting(false);
      setMessage({ type: "error", text: `Pilih ${sampleMode === "batch" ? "batch roasting" : "produk roasted bean"} terlebih dahulu.` });
      return;
    }

    const sensoryNotes = [
      descriptors.length > 0 ? `Descriptors: ${descriptors.join(", ")}` : "",
      notes.trim(),
    ].filter(Boolean).join("\n");

    const result = await createCuppingSession({
      batchId: selectedBatchId || undefined,
      productId: selectedProductId || undefined,
      lotId: lotId || undefined,
      defectCount: Number.isInteger(parsedDefects) && parsedDefects >= 0 ? parsedDefects : undefined,
      date: new Date(formData.get("date") as string),
      location: (formData.get("location") as string) || undefined,
      evaluatorName: (formData.get("evaluatorName") as string) || undefined,
      notes: sensoryNotes || undefined,
      scores: SCORE_DEFINITIONS.map((definition) => ({
        category: definition.key,
        score: scores[definition.key],
        maxScore: 10,
      })),
    });

    setSubmitting(false);
    if (result.success) {
      const gradeLabel = result.scaScore != null ? ` · SCA ${result.scaScore} (${SCA_GRADE_LABEL[scaGrade(result.scaScore)].label})` : "";
      setMessage({ type: "success", text: `Cupping ${result.code} tersimpan${gradeLabel}.` });
      setScores({ ...DEFAULT_SCORES });
      setDescriptors([]);
      setNotes("");
      setLotId("");
      setDefectCount("");
      await refreshData();
    } else {
      setMessage({ type: "error", text: result.error || "Sesi cupping gagal disimpan." });
    }
  }

  return (
    <StandardPageLayout
      title="Cupping lab"
      description="Tangkap karakter rasa, bandingkan hasil, dan putuskan apakah roast sudah sesuai tujuan."
      stage="roasting"
    >
      <div className="space-y-5">
        <form action={handleSubmit}>
          <Card className="overflow-hidden border-t-2 border-t-domain-roasting">
            <div className="border-b border-border bg-[linear-gradient(110deg,color-mix(in_srgb,var(--domain-roasting)_10%,transparent),transparent_55%)] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-xl">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-domain-roasting">Sensory workspace</p>
                  <h2 className="mt-1 font-heading text-xl font-bold tracking-[-0.04em] sm:text-2xl">Mulai dari sampel, bukan angka.</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Geser penilaian sesuai rasa yang ditemukan. Profil di samping akan terbentuk otomatis.</p>
                </div>
                <div className="inline-flex w-full rounded-xl border border-border bg-background/70 p-1 lg:w-auto">
                  {(["batch", "product"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSampleMode(mode)}
                      className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors lg:flex-none ${sampleMode === mode ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {mode === "batch" ? "Batch roasting" : "Produk roasted"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-7 p-5 sm:p-6">
                <section className="grid gap-4 rounded-xl border border-border/70 bg-background/45 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <Label className="mb-2 flex items-center gap-1.5 text-xs" htmlFor={sampleMode === "batch" ? "batchId" : "productId"}>
                      <Coffee className="h-3.5 w-3.5 text-domain-roasting" /> Sampel
                    </Label>
                    {sampleMode === "batch" ? (
                      <Select value={batchId || "__none__"} onValueChange={(value) => setBatchId(value === "__none__" || !value ? "" : value)}>
                        <SelectTrigger id="batchId" className="w-full bg-card">
                          <SelectValue>{batchId ? options.batches.find((batch) => batch.id === batchId)?.label : "Pilih batch terbaru"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Pilih batch</SelectItem>
                          {options.batches.map((batch) => <SelectItem key={batch.id} value={batch.id}>{batch.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={productId || "__none__"} onValueChange={(value) => setProductId(value === "__none__" || !value ? "" : value)}>
                        <SelectTrigger id="productId" className="w-full bg-card">
                          <SelectValue>{productId ? options.products.find((product) => product.id === productId)?.name : "Pilih roasted bean"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Pilih produk</SelectItem>
                          {options.products.map((product) => <SelectItem key={product.id} value={product.id}>{product.code} · {product.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="date" className="mb-2 flex items-center gap-1.5 text-xs"><CalendarDays className="h-3.5 w-3.5 text-domain-roasting" /> Tanggal</Label>
                    <Input id="date" name="date" type="date" required value={cuppingDate} onChange={(e) => setCuppingDate(e.target.value)} className="bg-card" />
                  </div>
                  <div>
                    <Label htmlFor="evaluatorName" className="mb-2 flex items-center gap-1.5 text-xs"><UserRound className="h-3.5 w-3.5 text-domain-roasting" /> Evaluator</Label>
                    <Input id="evaluatorName" name="evaluatorName" placeholder="Nama pencicip" className="bg-card" />
                  </div>
                  <div>
                    <Label htmlFor="location" className="mb-2 flex items-center gap-1.5 text-xs"><MapPin className="h-3.5 w-3.5 text-domain-roasting" /> Lokasi</Label>
                    <Input id="location" name="location" placeholder="Lab / cupping room" className="bg-card" />
                  </div>
                  <div>
                    <Label className="mb-2 flex items-center gap-1.5 text-xs"><Sprout className="h-3.5 w-3.5 text-domain-inventory" /> Lot green bean <span className="font-medium normal-case text-muted-foreground">(opsional)</span></Label>
                    <Select value={lotId || "__none__"} onValueChange={(value) => setLotId(value === "__none__" || !value ? "" : value)}>
                      <SelectTrigger id="lotId" className="w-full bg-card">
                        <SelectValue>{lotId ? options.lots.find((lot) => lot.id === lotId)?.label : "Tautkan ke lot"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Tanpa lot</SelectItem>
                        {options.lots.map((lot) => <SelectItem key={lot.id} value={lot.id}>{lot.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="defectCount" className="mb-2 flex items-center gap-1.5 text-xs"><TriangleAlert className="h-3.5 w-3.5 text-domain-roasting" /> Defect <span className="font-medium normal-case text-muted-foreground">(−2 poin/defect)</span></Label>
                    <Input
                      id="defectCount"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      placeholder="0"
                      value={defectCount}
                      onChange={(event) => setDefectCount(event.target.value)}
                      className="bg-card tabular-nums"
                    />
                  </div>
                </section>

                {SCORE_GROUPS.map((group) => (
                  <section key={group.title}>
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-domain-roasting">{group.eyebrow}</p>
                        <h3 className="mt-0.5 font-heading text-lg font-bold tracking-[-0.035em]">{group.title}</h3>
                      </div>
                      <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{group.description}</p>
                    </div>
                    <div className={`grid gap-3 ${group.scores.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
                      {group.scores.map((definition) => (
                        <ScoreSlider
                          key={definition.key}
                          definition={definition}
                          value={scores[definition.key]}
                          onChange={(value) => setScores((current) => ({ ...current, [definition.key]: value }))}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                <section className="rounded-xl border border-border/70 bg-background/45 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-domain-roasting" />
                    <h3 className="font-heading text-sm font-bold">Apa yang terasa?</h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Pilih descriptor yang dominan, lalu tambahkan konteks yang penting.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DESCRIPTORS.map((descriptor) => {
                      const active = descriptors.includes(descriptor);
                      return (
                        <button
                          key={descriptor}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleDescriptor(descriptor)}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-domain-roasting bg-domain-roasting text-white" : "border-border bg-card text-muted-foreground hover:border-domain-roasting/40 hover:text-foreground"}`}
                        >
                          {active && <Check className="h-3 w-3" />}{descriptor}
                        </button>
                      );
                    })}
                  </div>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    className="mt-4 bg-card"
                    placeholder="Contoh: juicy saat panas, sweetness turun saat dingin, finish sedikit dry..."
                  />
                </section>
              </div>

              <aside className="border-t border-border bg-foreground/[0.025] p-5 xl:border-l xl:border-t-0 xl:p-6">
                <div className="top-24 space-y-5 xl:sticky">
                  <div className="text-center">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Live sensory profile</p>
                    <ScoreDial average={averageScore} />
                    <p className="text-xs text-muted-foreground">Rata-rata dari 11 atribut</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-card/65 p-4">
                    <SensoryMap scores={scores} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Skor SCA</p>
                      <p className="mt-1 font-heading text-xl font-bold tracking-[-0.04em] tabular-nums">{liveScaScore.toFixed(2)}<span className="ml-1 text-xs font-medium text-muted-foreground">/100</span></p>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-domain-roasting">{SCA_GRADE_LABEL[scaGrade(liveScaScore)].label}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Total mentah</p>
                      <p className="mt-1 font-heading text-xl font-bold tracking-[-0.04em] tabular-nums">{totalScore.toFixed(2)}<span className="ml-1 text-xs font-medium text-muted-foreground">/110</span></p>
                    </div>
                  </div>

                  {message && (
                    <div role="status"                     className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-[var(--status-success)]/30 bg-[var(--status-success)]/10 text-[var(--status-success)]" : "border-destructive/25 bg-destructive/5 text-destructive"}`}>
                      {message.text}
                    </div>
                  )}

                  <Button type="submit" disabled={submitting} size="lg" className="w-full">
                    <Droplets className="h-4 w-4" />
                    {submitting ? "Menyimpan evaluasi..." : "Simpan hasil cupping"}
                  </Button>
                  <p className="text-center text-xs leading-relaxed text-muted-foreground">Cupping bersifat opsional. Simpan hanya ketika hasil ini berguna untuk QC atau pengembangan profil.</p>
                </div>
              </aside>
            </div>
          </Card>
        </form>

        <Card className="p-8">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-domain-roasting">Sensory archive</p>
              <h2 className="mt-1 font-heading text-xl font-bold tracking-[-0.04em]">Riwayat cupping</h2>
              <p className="mt-1 text-sm text-muted-foreground">Hasil terbaru untuk QC, pengembangan profil, dan pembanding roast berikutnya.</p>
            </div>
            {sessions.length > 0 && <p className="text-xs font-medium text-muted-foreground">{sessions.length} evaluasi terbaru</p>}
          </div>
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background/35 px-5 py-12 text-center">
              <Coffee className="mx-auto h-8 w-8 text-domain-roasting/55" />
              <p className="mt-3 font-heading text-base font-bold">Belum ada profil rasa</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Pilih batch yang memang perlu dievaluasi. Hasil pertama akan muncul sebagai kartu pembanding di sini.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sessions.map((session) => <HistoryCard key={session.id} session={session} />)}
            </div>
          )}
        </Card>
      </div>
    </StandardPageLayout>
  );
}
