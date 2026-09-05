import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  FLAG_REQUEST_HEADER,
  parseFlagRequestHeader,
} from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

const BASE_URL = "https://roastd.id";

export const metadata: Metadata = {
  title: "Pindah dari Cropster — Simpan data, bayar 1/10",
  description:
    "roastd.id menawarkan seluruh paket Cropster (Roastery Portal + Production + Inventory + Lab + Marketplace) dalam satu langganan dengan harga di bawah USD 50/tenant/bulan. Impor CSV Anda.",
  alternates: { canonical: `${BASE_URL}/compare/cropster` },
  openGraph: {
    title: "Pindah dari Cropster ke roastd.id",
    description: "Satu paket all-in-one dengan harga di bawah 1/10 Cropster.",
    url: `${BASE_URL}/compare/cropster`,
    siteName: "roastd.id",
    locale: "id_ID",
    type: "website",
  },
};

const IDR_PRICING = {
  cropsterFullStack: "USD 500+/bulan",
  roastd: "Rp 355.000/bulan (≈ USD 22)",
};

const POSITION_TABLE = [
  {
    capability: "Inventory ledger + traceability",
    cropster: "Add-on terpisah",
    roastd: "Built-in · weighted-average dari ledger",
  },
  {
    capability: "Roasting profile + Artisan ingest",
    cropster: "Hub + Probat add-on",
    roastd: "Webhook bawaan + .alog replay",
  },
  {
    capability: "Production / recipe / HPP",
    cropster: "Production module (per-seat)",
    roastd: "Built-in · otomatis dari ledger",
  },
  {
    capability: "Sales / POS (Kasir)",
    cropster: "Modul terpisah",
    roastd: "Built-in · offline-tolerant draft",
  },
  {
    capability: "Roastery Portal / Storefront",
    cropster: "Portal add-on",
    roastd: "Built-in · custom domain included",
  },
  {
    capability: "Cupping / SCA scoring",
    cropster: "Cupping module (Lab)",
    roastd: "Built-in · SCA composite",
  },
  {
    capability: "B2B contracts + receivable aging",
    cropster: "Add-on",
    roastd: "Built-in",
  },
  {
    capability: "Reporting (PDF/Excel)",
    cropster: "Per-modul",
    roastd: "Semua laporan dalam satu paket",
  },
  {
    capability: "Self-serve onboarding",
    cropster: "Sales-led",
    roastd: "Self-serve wizard < 30 menit",
  },
  {
    capability: "Publikasi harga transparan",
    cropster: "Quote-only",
    roastd: "Publik (IDR)",
  },
];

const IMPORT_STEPS = [
  {
    title: "1. Ekspor CSV dari Cropster",
    body:
      "Ekspor data lot, batch, dan cupping dari Cropster. Kami tidak scrape — Anda memegang datanya.",
  },
  {
    title: "2. Upload ke roastd.id",
    body:
      "Login ke workspace baru Anda, buka Setup → Impor, dan unggah CSV. Sistem akan memetakan kolom secara otomatis.",
  },
  {
    title: "3. Validasi + lanjut operasional",
    body:
      "Tinjau hasil impor (lot, batch, cupping) di dashboard sebelum go-live. Mulai catat transaksi baru dari titik tersebut.",
  },
];

export default async function CropsterComparePage() {
  const flagHeader = (await headers()).get(FLAG_REQUEST_HEADER);
  const flags = parseFlagRequestHeader(flagHeader);
  const enabled = flags["cropster-killer"] ?? false;

  if (!enabled) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-ink-tertiary">
          roastd.id · Cropster migration
        </p>
        <h1 className="mt-6 font-heading text-3xl font-bold leading-[1.05] tracking-[-0.04em] text-ink">
          Cropster migration page sedang dalam persiapan
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-ink-secondary">
          Kami sedang menyiapkan template CSV dan alur impor otomatis. Sementara
          itu, lihat halaman harga publik dan mulai uji coba gratis.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-card border border-transparent bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Lihat harga <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-card border border-border bg-card px-5 text-sm font-bold text-foreground hover:border-primary/55 hover:bg-accent"
          >
            Mulai trial
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-paper">
      <section className="border-b border-border bg-surface-inverse text-white">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#F2A17F]">
            Cropster · Comparison
          </p>
          <h1 className="mt-5 max-w-3xl font-heading text-[clamp(2.4rem,4.4vw,4rem)] font-bold leading-[0.94] tracking-[-0.05em]">
            Pindah dari Cropster.
            <br />
            Simpan datamu. Bayar 1/10.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/55">
            Kami tidak meminta Anda meninggalkan Cropster tanpa cadangan.
            Ekspor CSV → impor ke roastd.id → operasional jalan pada hari yang sama.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-white/10 bg-white/[0.04] p-6">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Cropster full stack
              </p>
              <p className="mt-3 font-heading text-3xl font-bold">
                {IDR_PRICING.cropsterFullStack}
              </p>
              <p className="mt-2 text-xs leading-5 text-white/45">
                Modul ditagih terpisah: Roastery Portal + Production + Inventory + Lab.
              </p>
            </div>
            <div className="rounded-card border border-[#C6542F]/40 bg-[#C6542F]/15 p-6">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#F2A17F]">
                roastd.id Pro
              </p>
              <p className="mt-3 font-heading text-3xl font-bold">
                {IDR_PRICING.roastd}
              </p>
              <p className="mt-2 text-xs leading-5 text-white/55">
                Semua modul termasuk · capacity-tiered · tanpa add-on tersembunyi.
              </p>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register?ref=cropster"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-card border border-transparent bg-copper px-6 text-sm font-bold text-white hover:bg-copper-strong"
            >
              Mulai migrasi <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-card border border-white/15 bg-transparent px-6 text-sm font-bold text-white/80 hover:border-white/40 hover:text-white"
            >
              Lihat harga publik
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-paper py-16 sm:py-20" aria-labelledby="position-heading">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-end gap-3">
            <CircleDollarSign className="size-6 text-copper" aria-hidden="true" />
            <h2
              id="position-heading"
              className="font-heading text-3xl font-bold leading-tight tracking-[-0.03em] text-ink"
            >
              Apa yang Anda bayar ekstra di Cropster
            </h2>
          </div>
          <div className="mt-8 overflow-x-auto rounded-card border border-border bg-card shadow-elevation-soft">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-left font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                  <th scope="col" className="px-5 py-3 font-bold">Kemampuan</th>
                  <th scope="col" className="px-5 py-3">Cropster</th>
                  <th scope="col" className="px-5 py-3 text-copper">roastd.id</th>
                </tr>
              </thead>
              <tbody>
                {POSITION_TABLE.map((row, index) => (
                  <tr key={row.capability} className={index % 2 === 0 ? "bg-card" : "bg-paper-sunken"}>
                    <th scope="row" className="px-5 py-3 text-left font-medium text-ink">{row.capability}</th>
                    <td className="px-5 py-3 text-ink-secondary">
                      <span className="inline-flex items-center gap-2">
                        <X className="size-3.5 text-ink-tertiary" aria-hidden="true" />
                        {row.cropster}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink">
                      <span className="inline-flex items-center gap-2">
                        <Check className="size-3.5 text-copper" aria-hidden="true" />
                        {row.roastd}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-canvas py-16 sm:py-20" aria-labelledby="import-heading">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-end gap-3">
            <FileSpreadsheet className="size-6 text-copper" aria-hidden="true" />
            <h2
              id="import-heading"
              className="font-heading text-3xl font-bold leading-tight tracking-[-0.03em] text-ink"
            >
              Impor CSV dalam tiga langkah
            </h2>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-secondary">
            Tidak ada lock-in. Tidak ada scraping. CSV dari modul Cropster Anda
            tetap menjadi CSV — kami memetakan kolomnya untuk Anda.
          </p>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {IMPORT_STEPS.map((step, index) => (
              <li key={step.title} className="rounded-card border border-border bg-card p-6 shadow-elevation-soft">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-copper">
                  Step {index + 1}
                </p>
                <h3 className="mt-3 font-heading text-base font-bold tracking-[-0.02em] text-ink">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-ink-secondary">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-paper py-16 sm:py-20" aria-labelledby="trust-heading">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <ShieldCheck className="mx-auto size-8 text-copper" aria-hidden="true" />
          <h2
            id="trust-heading"
            className="mt-5 font-heading text-2xl font-bold leading-tight tracking-[-0.03em] text-ink"
          >
            Tenancy terisolasi. Server action memeriksa peran independen dari UI.
          </h2>
          <p className="mt-4 text-sm leading-7 text-ink-secondary">
            Audit tenant-isolation adalah bagian dari release gate harian roastd.id.
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-canvas py-12">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-6 sm:flex-row sm:items-center">
          <p className="max-w-md text-sm leading-6 text-ink-secondary">
            Sudah memiliki akun roastd.id? Lanjutkan migrasi dari dashboard Setup → Impor.
          </p>
          <Link
            href="/settings/import"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-card border border-border bg-card px-5 text-sm font-bold text-foreground hover:border-primary/55 hover:bg-accent"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Lanjutkan impor
          </Link>
        </div>
      </section>
    </main>
  );
}