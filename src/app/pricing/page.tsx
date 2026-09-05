import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  Check,
  Minus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PLAN_CATALOG } from "@/lib/plans";
import {
  FLAG_REQUEST_HEADER,
  parseFlagRequestHeader,
} from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

const BASE_URL = "https://roastd.id";

export const metadata: Metadata = {
  title: "Harga roastd.id — Satu paket, semua fitur, di bawah USD 50/bulan",
  description:
    "roastd.id — roastery operating system. IDR 355.000/tenant/bulan untuk ledger, roasting, produksi, penjualan, kasir, storefront, dan laporan. Bandingkan dengan Cropster.",
  alternates: { canonical: `${BASE_URL}/pricing` },
  openGraph: {
    title: "Harga roastd.id",
    description: "Satu paket all-in-one di bawah USD 50/tenant/bulan.",
    url: `${BASE_URL}/pricing`,
    siteName: "roastd.id",
    locale: "id_ID",
    type: "website",
  },
};

const IDR = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const FEATURE_BUNDLES = [
  {
    title: "Operasional inti",
    items: [
      "Lot, inventory ledger (FEFO)",
      "Roasting batch + Artisan webhooks",
      "Produksi, resep, HPP otomatis",
      "Penjualan, kasir, storefront",
    ],
  },
  {
    title: "Keuangan & kepatuhan",
    items: [
      "Piutang, hutang, jurnal",
      "Midtrans + bukti bayar QRIS manual",
      "PPh/PPN-aware invoice numbering",
      "Daily Brief + laporan PDF/Excel",
    ],
  },
  {
    title: "Bisnis & multi-tenant",
    items: [
      "Custom domain + tema portal",
      "Audit trail + tenant isolation",
      "B2B contract + receivable aging",
      "Cupping (SCA) + Roastd Studio",
    ],
  },
];

type Cell = "yes" | "no" | "partial" | "na";

interface ComparisonRow {
  capability: string;
  roastd: string;
  cropster: Cell;
  artisan: Cell;
  roastlog: Cell;
  roastime: Cell;
}

const COMPARISON: ComparisonRow[] = [
  {
    capability: "Inventory ledger immutable + VOID/reversal",
    roastd: "yes",
    cropster: "yes",
    artisan: "no",
    roastlog: "no",
    roastime: "no",
  },
  {
    capability: "Multi-tenant SaaS",
    roastd: "yes",
    cropster: "yes",
    artisan: "no",
    roastlog: "no",
    roastime: "no",
  },
  {
    capability: "Roasting batch + green→roasted lot traceability",
    roastd: "yes",
    cropster: "yes",
    artisan: "partial",
    roastlog: "partial",
    roastime: "partial",
  },
  {
    capability: "Artisan hardware telemetry ingest",
    roastd: "yes",
    cropster: "partial",
    artisan: "yes",
    roastlog: "partial",
    roastime: "partial",
  },
  {
    capability: "Production / recipe / HPP otomatis",
    roastd: "yes",
    cropster: "yes",
    artisan: "no",
    roastlog: "no",
    roastime: "no",
  },
  {
    capability: "Roast profile analytics (RoR, ΔT, replay)",
    roastd: "yes",
    cropster: "yes",
    artisan: "yes",
    roastlog: "partial",
    roastime: "partial",
  },
  {
    capability: "Cupping / SCA scoring + sessions",
    roastd: "yes",
    cropster: "yes",
    artisan: "no",
    roastlog: "yes",
    roastime: "no",
  },
  {
    capability: "Sales / invoice / POS (Kasir)",
    roastd: "yes",
    cropster: "partial",
    artisan: "no",
    roastlog: "no",
    roastime: "no",
  },
  {
    capability: "Storefront + checkout publik",
    roastd: "yes",
    cropster: "partial",
    artisan: "no",
    roastlog: "no",
    roastime: "no",
  },
  {
    capability: "Manual payment proof (QRIS / transfer)",
    roastd: "yes",
    cropster: "yes",
    artisan: "na",
    roastlog: "na",
    roastime: "na",
  },
  {
    capability: "Midtrans + payment gateway",
    roastd: "yes",
    cropster: "partial",
    artisan: "na",
    roastlog: "na",
    roastime: "na",
  },
  {
    capability: "Subscription billing + tier feature gating",
    roastd: "yes",
    cropster: "partial",
    artisan: "no",
    roastlog: "no",
    roastime: "no",
  },
  {
    capability: "Self-serve onboarding < 30 menit",
    roastd: "yes",
    cropster: "no",
    artisan: "yes",
    roastlog: "yes",
    roastime: "yes",
  },
  {
    capability: "Publikasi harga transparan",
    roastd: "yes",
    cropster: "no",
    artisan: "yes",
    roastlog: "yes",
    roastime: "yes",
  },
];

function CellBadge({ value }: { value: Cell }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900" aria-label="yes">
        <Check className="size-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900" aria-label="partial">
        <Sparkles className="size-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (value === "na") {
    return (
      <span className="text-xs font-bold text-ink-tertiary" aria-label="not applicable">
        n/a
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-stone-200 px-2.5 py-1 text-xs font-bold text-stone-700" aria-label="no">
      <Minus className="size-3.5" aria-hidden="true" />
    </span>
  );
}

export default async function PricingPage() {
  const flagHeader = (await headers()).get(FLAG_REQUEST_HEADER);
  const flags = parseFlagRequestHeader(flagHeader);
  const pricingEnabled = flags["public-pricing"] ?? false;
  const pro = PLAN_CATALOG.PRO;
  const trial = PLAN_CATALOG.TRIAL;

  if (!pricingEnabled) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-ink-tertiary">
          roastd.id · Pricing
        </p>
        <h1 className="mt-6 font-heading text-3xl font-bold leading-[1.05] tracking-[-0.04em] text-ink">
          Halaman harga sedang dipersiapkan
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-ink-secondary">
          Kami sedang memfinalisasi paket publik dan tabel perbandingan. Untuk akses awal,
          mulai uji coba gratis — semua fitur aktif selama 21 hari tanpa kartu kredit.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-card border border-transparent bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_8px_20px_-14px_rgba(91,32,17,.65)] hover:bg-primary/90"
          >
            Mulai 21 hari gratis <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-card border border-border bg-card px-5 text-sm font-bold text-foreground hover:border-primary/55 hover:bg-accent"
          >
            Kembali ke beranda
          </Link>
        </div>
      </main>
    );
  }

  const yearlyTotal = pro.yearlyPrice ?? 0;
  const monthlyEquivalent = yearlyTotal > 0 ? Math.round(yearlyTotal / 12) : 0;
  const yearlySavings = (pro.monthlyPrice ?? 0) * 12 - yearlyTotal;

  return (
    <main className="bg-paper">
      <section className="border-b border-border bg-canvas">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-copper">
            Harga · IDR · Tanpa modul tersembunyi
          </p>
          <h1 className="mt-5 max-w-3xl font-heading text-[clamp(2.4rem,4.4vw,4rem)] font-bold leading-[0.94] tracking-[-0.05em] text-ink">
            Satu paket all-in-one untuk roastery.
            <br />
            Di bawah USD 50 per tenant per bulan.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-ink-secondary">
            Ledger, roasting, produksi, penjualan, kasir, storefront, cupping, B2B,
            dan laporan dalam satu langganan — bukan tumpukan modul yang ditagih
            terpisah seperti kompetitor.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-border bg-card p-6 shadow-elevation-soft">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-tertiary">
                Trial
              </p>
              <p className="mt-3 font-heading text-3xl font-bold text-ink">
                {IDR(trial.monthlyPrice ?? 0)}
              </p>
              <p className="mt-2 text-xs leading-5 text-ink-secondary">
                21 hari · semua fitur · tanpa kartu kredit.
              </p>
            </div>
            <div className="rounded-card border-2 border-copper bg-surface-inverse p-6 text-white shadow-elevation-card">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#F2A17F]">
                Pro · satu-satunya paket
              </p>
              <p className="mt-3 font-heading text-3xl font-bold">
                {IDR(pro.monthlyPrice ?? 0)}
              </p>
              <p className="mt-1 text-xs leading-5 text-white/55">
                per tenant / bulan
              </p>
              {pro.yearlyPrice ? (
                <p className="mt-3 text-xs leading-5 text-white/65">
                  Tahunan {IDR(pro.yearlyPrice)} ≈ {IDR(monthlyEquivalent)}/bulan
                  · hemat {IDR(yearlySavings)}.
                </p>
              ) : null}
            </div>
            <div className="rounded-card border border-border bg-card p-6 shadow-elevation-soft">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-tertiary">
                Kapasitas tier
              </p>
              <p className="mt-3 font-heading text-base font-bold leading-snug text-ink">
                User, batch, invoice.
              </p>
              <p className="mt-2 text-xs leading-5 text-ink-secondary">
                Kapasitas menyesuaikan paket — bukan fitur. White-label adalah
                add-on opsional untuk reseller.
              </p>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-card border border-transparent bg-copper px-6 text-sm font-bold text-white shadow-[0_8px_20px_-14px_rgba(91,32,17,.65)] hover:bg-copper-strong"
            >
              Mulai 21 hari gratis <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/compare/cropster"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-card border border-border bg-card px-6 text-sm font-bold text-foreground hover:border-primary/55 hover:bg-accent"
            >
              Bandingkan dengan Cropster
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-paper py-16 sm:py-20" aria-labelledby="bundles-heading">
        <div className="mx-auto max-w-5xl px-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-copper">
            Yang termasuk
          </p>
          <h2
            id="bundles-heading"
            className="mt-3 font-heading text-3xl font-bold leading-tight tracking-[-0.03em] text-ink"
          >
            Tidak ada modul tambahan untuk dibeli.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {FEATURE_BUNDLES.map((bundle) => (
              <article
                key={bundle.title}
                className="rounded-card border border-border bg-card p-6 shadow-elevation-soft"
              >
                <h3 className="font-heading text-base font-bold tracking-[-0.02em] text-ink">
                  {bundle.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {bundle.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-5 text-ink-secondary">
                      <Check className="mt-0.5 size-4 shrink-0 text-copper" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-canvas py-16 sm:py-20" aria-labelledby="compare-heading">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-copper">
                Perbandingan
              </p>
              <h2
                id="compare-heading"
                className="mt-3 font-heading text-3xl font-bold leading-tight tracking-[-0.03em] text-ink"
              >
                Kami vs kompetitor
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-ink-secondary">
              Data berasal dari riset publik dan dokumentasi masing-masing produk
              per akhir 2025. Selalu periksa perubahan terbaru di situs resmi.
            </p>
          </div>
          <div className="mt-8 overflow-x-auto rounded-card border border-border bg-card shadow-elevation-soft">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-left font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                  <th scope="col" className="px-5 py-3 font-bold">Kemampuan</th>
                  <th scope="col" className="px-5 py-3 text-copper">roastd.id</th>
                  <th scope="col" className="px-5 py-3">Cropster</th>
                  <th scope="col" className="px-5 py-3">Artisan</th>
                  <th scope="col" className="px-5 py-3">RoastLog</th>
                  <th scope="col" className="px-5 py-3">RoasTime</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, index) => (
                  <tr
                    key={row.capability}
                    className={index % 2 === 0 ? "bg-card" : "bg-paper-sunken"}
                  >
                    <th scope="row" className="px-5 py-3 text-left text-ink">
                      {row.capability}
                    </th>
                    <td className="px-5 py-3 text-copper">{row.roastd}</td>
                    <td className="px-5 py-3 text-center"><CellBadge value={row.cropster} /></td>
                    <td className="px-5 py-3 text-center"><CellBadge value={row.artisan} /></td>
                    <td className="px-5 py-3 text-center"><CellBadge value={row.roastlog} /></td>
                    <td className="px-5 py-3 text-center"><CellBadge value={row.roastime} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-paper py-16 sm:py-20" aria-labelledby="trust-heading">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <ShieldCheck className="mx-auto size-8 text-copper" aria-hidden="true" />
          <h2
            id="trust-heading"
            className="mt-5 font-heading text-2xl font-bold leading-tight tracking-[-0.03em] text-ink"
          >
            Tenancy terisolasi. Tidak ada kebocoran antar-roastery.
          </h2>
          <p className="mt-4 text-sm leading-7 text-ink-secondary">
            Setiap akses dashboard melewati `requireTenantPrisma()` dan dicek
            ulang di server action — bukan hanya di UI. Audit
            tenant-isolation adalah bagian dari release gate harian.
          </p>
        </div>
      </section>
    </main>
  );
}