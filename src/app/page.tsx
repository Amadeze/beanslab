import { LandingClient } from "./LandingClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seluruh operasional roastery dalam satu sistem",
  description:
    "Hubungkan pembelian, inventory, roasting, produksi, penjualan, dan keuangan coffee roastery tanpa input data berulang.",
  openGraph: {
    title: "roastd.id — Roastery Operating System",
    description:
      "Satu alur untuk menjalankan pembelian, inventory, roasting, produksi, penjualan, dan keuangan roastery.",
    type: "website",
    locale: "id_ID",
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
