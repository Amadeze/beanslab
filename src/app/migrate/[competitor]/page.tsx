import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Check,
  FileSpreadsheet,
  Flame,
  Usb,
  X,
} from "lucide-react";
import {
  FLAG_REQUEST_HEADER,
  parseFlagRequestHeader,
} from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

const BASE_URL = "https://roastd.id";

type CompetitorId = "artisan" | "roastlog" | "roastime";

interface CompetitorCopy {
  id: CompetitorId;
  flagName: "artisan-migrant" | "roastlog-refugee" | "roasttime-bridge";
  eyebrow: string;
  heading: string;
  subheading: string;
  painTitle: string;
  pains: string[];
  gainTitle: string;
  gains: string[];
  importTitle: string;
  importSteps: string[];
  flagSymbol: string;
  ctaHint: string;
}

const COMPETITORS: Record<CompetitorId, CompetitorCopy> = {
  artisan: {
    id: "artisan",
    flagName: "artisan-migrant",
    eyebrow: "Artisan · Migrant",
    heading: "Sudah tumbuh di luar Artisan? Lanjutkan tanpa kehilangan jejak.",
    subheading:
      "Impor .alog Anda. Mulai pakai ledger, kasir, dan storefront dalam satu alur. Tidak perlu uninstall Artisan — pakai sesuai kebutuhan.",
    painTitle: "Apa yang biasanya berhenti bekerja setelah Artisan",
    pains: [
      "PO supplier tetap di spreadsheet terpisah",
      "Stok roasted bean tidak terhubung ke invoice",
      "Cupping score tidak sampai ke laporan HPP",
      "Owner bertanya ke operator setiap akhir hari",
    ],
    gainTitle: "Apa yang langsung Anda dapat",
    gains: [
      "Impor .alog via webhook yang sudah ada",
      "Lot, batch, dan stok bergerak otomatis",
      "Daily Brief menggantikan pertanyaan harian owner",
      "Trial 21 hari · tanpa kartu kredit",
    ],
    importTitle: "Cara membawa .alog Anda",
    importSteps: [
      "Buka Artisan → Ekspor .alog dari riwayat batch",
      "Upload ke roastd.id lewat Setup → Impor",
      "Sistem memetakan profil ke batch dan ledger",
    ],
    flagSymbol: "Artisan",
    ctaHint: "impor",
  },
  roastlog: {
    id: "roastlog",
    flagName: "roastlog-refugee",
    eyebrow: "RoastLog · Refugee",
    heading: "RoastLog sudah menyimpan bertahun-tahun roasting. roastd.id membuatnya bekerja.",
    subheading:
      "Impor CSV RoastLog (lot, batch, cupping). Mulai hitung HPP otomatis dan operasionalkan penjualan.",
    painTitle: "Apa yang biasanya menyakitkan di RoastLog",
    pains: [
      "Batch tercatat, tapi HPP harus dihitung manual",
      "Tidak ada invoicing atau storefront",
      "Cupping score tidak sampai ke laporan batch",
      "Tidak ada multi-user role untuk owner/operator",
    ],
    gainTitle: "Apa yang langsung Anda dapat",
    gains: [
      "CSV RoastLog termap ke lot, batch, dan cupping",
      "HPP otomatis dari ledger (bukan pakai)",
      "Penjualan, kasir, dan storefront dalam paket yang sama",
      "Audit tenant-isolation sebagai default",
    ],
    importTitle: "Cara membawa CSV RoastLog",
    importSteps: [
      "Ekspor lot, batch, dan cupping dari RoastLog",
      "Upload lewat Setup → Impor di workspace baru Anda",
      "Validasi hasil, lalu mulai transaksi baru",
    ],
    flagSymbol: "RoastLog",
    ctaHint: "impor",
  },
  roastime: {
    id: "roastime",
    flagName: "roasttime-bridge",
    eyebrow: "RoasTime · Hardware bridge",
    heading: "Tidak perlu keluar dari Bullet/Toper. roastd.id menerima .alog.",
    subheading:
      "Roastd Studio adalah hardware-bridge gratis. Pair dengan Roastd Studio, .alog tersinkron ke ledger Anda.",
    painTitle: "Mengapa roastery sering mengunci vendor",
    pains: [
      "Profil ada di software vendor — tidak bisa keluar",
      "Stok dan laporan tidak pernah nyambung",
      "Migrasi berarti kerja ulang manual",
      "Tidak ada audit lintas batch",
    ],
    gainTitle: "Apa yang langsung Anda dapat",
    gains: [
      "Roastd Studio: hardware-agnostic MQTT bridge",
      ".alog diserap ke ledger otomatis",
      "Bandingkan profil cross-vendor",
      "Tetap pakai Bullet/Toper Anda",
    ],
    importTitle: "Cara menyambungkan Roastd Studio",
    importSteps: [
      "Download Roastd Studio (Windows installer)",
      "Pair dengan workspace Anda via Studio → Authorize",
      "Mulai roasting — .alog otomatis tersinkron",
    ],
    flagSymbol: "RoasTime",
    ctaHint: "bridge",
  },
};

export function generateStaticParams() {
  return Object.keys(COMPETITORS).map((id) => ({ competitor: id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>;
}): Promise<Metadata> {
  const { competitor } = await params;
  const copy = COMPETITORS[competitor as CompetitorId];
  if (!copy) return { title: "Migrate · roastd.id" };
  return {
    title: `${copy.flagSymbol} → roastd.id migration`,
    description: copy.subheading,
    alternates: { canonical: `${BASE_URL}/migrate/${copy.id}` },
  };
}

export default async function MigrateCompetitorPage({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const { competitor } = await params;
  const copy = COMPETITORS[competitor as CompetitorId];
  if (!copy) notFound();

  const flagHeader = (await headers()).get(FLAG_REQUEST_HEADER);
  const flags = parseFlagRequestHeader(flagHeader);
  const enabled = flags[copy.flagName] ?? false;

  if (!enabled) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-ink-tertiary">
          roastd.id · {copy.flagSymbol} migration
        </p>
        <h1 className="mt-6 font-heading text-3xl font-bold leading-[1.05] tracking-[-0.04em] text-ink">
          {copy.flagSymbol} migration dalam persiapan
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-ink-secondary">
          Kami sedang menyiapkan template {copy.ctaHint} dan alur onboarding khusus.
          Sementara itu, mulai trial gratis untuk merasakan alur lengkap.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-card border border-transparent bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Mulai trial <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-card border border-border bg-card px-5 text-sm font-bold text-foreground hover:border-primary/55 hover:bg-accent"
          >
            Lihat harga
          </Link>
        </div>
      </main>
    );
  }

  const Icon = copy.id === "artisan" ? Flame : copy.id === "roastlog" ? FileSpreadsheet : Usb;

  return (
    <main className="bg-paper">
      <section className="border-b border-border bg-surface-inverse text-white">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#F2A17F]">
            {copy.eyebrow}
          </p>
          <h1 className="mt-5 max-w-3xl font-heading text-[clamp(2.2rem,4.2vw,3.8rem)] font-bold leading-[0.96] tracking-[-0.05em]">
            {copy.heading}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/55">
            {copy.subheading}
          </p>
          <div className="mt-10">
            <Link
              href={`/register?ref=migrate-${copy.id}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-card border border-transparent bg-copper px-6 text-sm font-bold text-white hover:bg-copper-strong"
            >
              {copy.id === "roastime" ? "Download Roastd Studio" : "Mulai migrasi"}{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-paper py-16 sm:py-20" aria-labelledby="pain-heading">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-end gap-3">
            <Icon className="size-6 text-copper" aria-hidden="true" />
            <h2
              id="pain-heading"
              className="font-heading text-2xl font-bold leading-tight tracking-[-0.03em] text-ink"
            >
              {copy.painTitle}
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {copy.pains.map((pain) => (
              <div key={pain} className="rounded-card border border-border bg-card p-5 shadow-elevation-soft">
                <p className="flex items-start gap-2 text-sm leading-6 text-ink-secondary">
                  <X className="mt-0.5 size-4 shrink-0 text-ink-tertiary" aria-hidden="true" />
                  <span>{pain}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-canvas py-16 sm:py-20" aria-labelledby="gain-heading">
        <div className="mx-auto max-w-5xl px-6">
          <h2
            id="gain-heading"
            className="font-heading text-2xl font-bold leading-tight tracking-[-0.03em] text-ink"
          >
            {copy.gainTitle}
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {copy.gains.map((gain) => (
              <li key={gain} className="flex items-start gap-3 rounded-card border border-border bg-card p-5 shadow-elevation-soft">
                <Check className="mt-0.5 size-4 shrink-0 text-copper" aria-hidden="true" />
                <span className="text-sm leading-6 text-ink">{gain}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-paper py-16 sm:py-20" aria-labelledby="import-heading">
        <div className="mx-auto max-w-5xl px-6">
          <h2
            id="import-heading"
            className="font-heading text-2xl font-bold leading-tight tracking-[-0.03em] text-ink"
          >
            {copy.importTitle}
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {copy.importSteps.map((step, index) => (
              <li key={step} className="rounded-card border border-border bg-card p-6 shadow-elevation-soft">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-copper">
                  Step {index + 1}
                </p>
                <p className="mt-3 text-sm leading-6 text-ink">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}