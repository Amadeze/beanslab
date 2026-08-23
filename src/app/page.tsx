export const dynamic = "force-dynamic";

import { LandingClient } from "./LandingClient";
import type { Metadata } from "next";
import { fetchLandingSocialProof } from "./_actions/landing-social-proof";

const BASE_URL = "https://roastd.id";

export const metadata: Metadata = {
  title: "roastd.id — Roastery Operating System + Studio",
  description:
    "Berhenti gabungin Excel, Artisan, dan nota manual setiap akhir shift. Satu alur dari lot green bean → roasting → produksi → penjualan → HPP & laporan untuk coffee roastery.",
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "roastd.id — Roastery Operating System",
    description:
      "Satu roast menggerakkan stok, HPP, produksi, dan laporan dalam alur operasional yang sama.",
    type: "website",
    locale: "id_ID",
    url: BASE_URL,
    siteName: "roastd.id",
    images: [
      {
        url: `${BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "roastd.id — Roastery Operating System. Roasting selesai. Operasional ikut bergerak.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "roastd.id — Roastery Operating System",
    description:
      "Satu roast menggerakkan stok, HPP, produksi, dan laporan. Coba gratis 21 hari.",
    images: [`${BASE_URL}/opengraph-image`],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "roastd.id",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Windows",
  description:
    "Sistem operasional multi-tenant untuk coffee roastery — menghubungkan lot green bean, roasting, produksi, penjualan, HPP, dan laporan dalam satu alur.",
  url: BASE_URL,
  inLanguage: "id",
  offers: {
    "@type": "Offer",
    price: "355000",
    priceCurrency: "IDR",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "355000",
      priceCurrency: "IDR",
      unitText: "bulan",
    },
  },
  featureList: [
    "Lot & inventory ledger (FEFO)",
    "Roasting batch & profile matching",
    "Roastd Studio (.alog)",
    "Produksi & HPP otomatis",
    "Penjualan & kasir offline-aware",
    "Keuangan (piutang, hutang, jurnal)",
    "Daily Brief & laporan keputusan",
    "Tenant isolation & role-based access",
  ],
};

export default async function LandingPage() {
  const socialProof = await fetchLandingSocialProof();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingClient socialProof={socialProof} />
    </>
  );
}
