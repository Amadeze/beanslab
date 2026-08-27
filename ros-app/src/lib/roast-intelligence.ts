// =============================================================================
// ROAST INTELLIGENCE — AI deterministik (gratis, tanpa LLM)
// 1. Clone profil: turunkan target RoastProfile langsung dari kurva roast nyata.
// 2. Konsistensi antar-batch: control chart sederhana (mean ± 2σ) untuk durasi,
//    loss, suhu drop, dan waktu first crack — plus skor 0–100.
// Semua fungsi murni & JSON-safe; diuji di roast-intelligence.test.ts.
// =============================================================================

export type RoastMetricsForProfile = {
  chargeTemperature?: number | null;
  dropTemperature?: number | null;
  firstCrackStartTime?: number | null;
  firstCrackEndTime?: number | null;
  /** Detik dari charge sampai drop; fallback duration bila kosong. */
  dropTime?: number | null;
  duration?: number | null;
};

export type DerivedProfileTargets = {
  chargeTemp: number | null;
  targetFirstCrackStart: number | null;
  targetFirstCrackEnd: number | null;
  /** Persen waktu FC-start → drop terhadap total waktu roast (definisi klasik). */
  developmentTarget: number | null;
  dropTemp: number | null;
  /** Field yang berhasil diturunkan — untuk transparansi UI. */
  derivedFrom: string[];
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Turunkan target profil dari satu roast nyata. Deterministik:
 * charge/drop temp dipakai apa adanya; dev% = (drop − FCstart)/total × 100.
 */
export function deriveProfileTargetsFromRoast(roast: RoastMetricsForProfile): DerivedProfileTargets {
  const derivedFrom: string[] = [];
  const totalTime =
    typeof roast.dropTime === "number" && roast.dropTime > 0
      ? roast.dropTime
      : typeof roast.duration === "number" && roast.duration > 0
        ? roast.duration
        : null;

  const chargeTemp =
    typeof roast.chargeTemperature === "number" ? round1(roast.chargeTemperature) : null;
  if (chargeTemp !== null) derivedFrom.push("chargeTemp");

  const dropTemp = typeof roast.dropTemperature === "number" ? round1(roast.dropTemperature) : null;
  if (dropTemp !== null) derivedFrom.push("dropTemp");

  const fcStart =
    typeof roast.firstCrackStartTime === "number" && roast.firstCrackStartTime > 0
      ? Math.round(roast.firstCrackStartTime)
      : null;
  if (fcStart !== null) derivedFrom.push("targetFirstCrackStart");

  const fcEnd =
    typeof roast.firstCrackEndTime === "number" &&
    roast.firstCrackEndTime > 0 &&
    fcStart !== null &&
    roast.firstCrackEndTime >= (roast.firstCrackStartTime ?? 0)
      ? Math.round(roast.firstCrackEndTime)
      : null;
  if (fcEnd !== null) derivedFrom.push("targetFirstCrackEnd");

  let developmentTarget: number | null = null;
  if (fcStart !== null && totalTime !== null && totalTime > fcStart) {
    developmentTarget = round1(((totalTime - fcStart) / totalTime) * 100);
    derivedFrom.push("developmentTarget");
  }

  return {
    chargeTemp,
    targetFirstCrackStart: fcStart,
    targetFirstCrackEnd: fcEnd,
    developmentTarget,
    dropTemp,
    derivedFrom,
  };
}

/** Bisa dipakai sebagai sumber clone minimal: punya charge & drop temp. */
export function isCloneableRoast(roast: RoastMetricsForProfile): boolean {
  return (
    typeof roast.chargeTemperature === "number" &&
    typeof roast.dropTemperature === "number"
  );
}

// =============================================================================
// Konsistensi antar-batch (control chart)
// =============================================================================

export type MetricStats = {
  key: string;
  label: string;
  sampleCount: number;
  mean: number;
  stdDev: number;
  /** Batas kontrol mean ± 2σ (null bila sampel < MIN_SAMPLES). */
  lower: number | null;
  upper: number | null;
  unit: string;
};

export type ConsistencyVerdict = "STABLE" | "WATCH" | "VARIABLE" | "NEEDS_DATA";

export type RoastConsistencyReport = {
  verdict: ConsistencyVerdict;
  /** 0–100; null saat NEEDS_DATA. */
  score: number | null;
  metrics: MetricStats[];
  note: string;
};

export type RoastMetricSample = {
  roastId?: string | null;
  duration?: number | null;
  lossPercent?: number | null;
  dropTemperature?: number | null;
  firstCrackStartTime?: number | null;
};

const MIN_SAMPLES = 3;

/** Bobot penalti per metrik — jumlah = 1. Loss paling menentukan rasa. */
const METRIC_WEIGHTS: Record<string, number> = {
  lossPercent: 0.35,
  duration: 0.25,
  firstCrackStartTime: 0.2,
  dropTemperature: 0.2,
};

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  duration: { label: "Durasi", unit: "s" },
  lossPercent: { label: "Loss", unit: "%" },
  dropTemperature: { label: "Suhu drop", unit: "°C" },
  firstCrackStartTime: { label: "First crack", unit: "s" },
};

function stdDev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function buildMetricStats(key: string, values: number[]): MetricStats {
  const count = values.length;
  const mean = count > 0 ? values.reduce((a, b) => a + b, 0) / count : 0;
  const sd = stdDev(values, mean);
  const hasControl = count >= MIN_SAMPLES;
  const meta = METRIC_LABELS[key] ?? { label: key, unit: "" };
  return {
    key,
    label: meta.label,
    unit: meta.unit,
    sampleCount: count,
    mean: round1(mean),
    stdDev: round1(sd),
    lower: hasControl ? round1(mean - 2 * sd) : null,
    upper: hasControl ? round1(mean + 2 * sd) : null,
  };
}

/** True bila nilai berada di luar batas mean ± 2σ. */
export function isOutlier(value: number | null | undefined, stats: MetricStats | undefined): boolean {
  if (!stats || stats.lower === null || stats.upper === null) return false;
  if (typeof value !== "number") return false;
  return value < stats.lower || value > stats.upper;
}

/**
 * Skor konsistensi lintas batch untuk SATU produk output.
 * Penalti per metrik = min(25, CV% × 100 × bobot); skor = 100 − Σ penalti.
 */
export function computeRoastConsistency(samples: RoastMetricSample[]): RoastConsistencyReport {
  const pick = (key: keyof RoastMetricSample) =>
    samples.map((s) => s[key]).filter((v): v is number => typeof v === "number");

  const keys = ["lossPercent", "duration", "firstCrackStartTime", "dropTemperature"] as const;
  const metrics = keys.map((key) => buildMetricStats(key, pick(key)));

  const usable = metrics.filter((m) => m.sampleCount >= MIN_SAMPLES);
  if (usable.length === 0 || samples.length < MIN_SAMPLES) {
    return {
      verdict: "NEEDS_DATA",
      score: null,
      metrics,
      note: `Butuh minimal ${MIN_SAMPLES} roast dengan data lengkap untuk menilai konsistensi.`,
    };
  }

  let penalty = 0;
  for (const metric of usable) {
    const weight = METRIC_WEIGHTS[metric.key] ?? 0;
    const base = Math.abs(metric.mean) > 1e-9 ? metric.mean : 1;
    const cvPercent = (metric.stdDev / Math.abs(base)) * 100;
    penalty += Math.min(25, cvPercent * weight);
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const verdict: ConsistencyVerdict = score >= 85 ? "STABLE" : score >= 70 ? "WATCH" : "VARIABLE";
  const note =
    verdict === "STABLE"
      ? "Batch konsisten — profil ini terkendali."
      : verdict === "WATCH"
        ? "Ada variasi yang patut diamati — cek metrik di luar batas."
        : "Variasi tinggi antar batch — tinjau prosedur atau mesin.";

  return { verdict, score, metrics, note };
}
