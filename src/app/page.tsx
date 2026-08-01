import { LandingClient } from "./LandingClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "roastd.id — Roastery Operating System + Studio",
  description:
    "Hubungkan lot, roasting, profile matching, produksi, penjualan, stok, HPP, dan laporan coffee roastery tanpa input data berulang.",
  openGraph: {
    title: "roastd.id — Roastery Operating System + Roastd Studio",
    description:
      "Satu roast menggerakkan stok, HPP, produksi, dan laporan dalam alur operasional yang sama.",
    type: "website",
    locale: "id_ID",
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
