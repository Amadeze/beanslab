import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import {
  FLAG_REQUEST_HEADER,
  isFlagEnabledFromSnapshot,
  parseFlagRequestHeader,
} from "@/lib/featureFlags";
import { notFound } from "next/navigation";
import { getHppKpi } from "../hpp-actions";
import { HppKpiTile } from "../_components/HppKpiTile";

export const dynamic = "force-dynamic";

export default async function HppDashboardPage() {
  const flagHeader = (await headers()).get(FLAG_REQUEST_HEADER);
  const flags = parseFlagRequestHeader(flagHeader);
  if (!isFlagEnabledFromSnapshot(flags, "hpp-ledger-tile")) {
    notFound();
  }
  const data = await getHppKpi();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-secondary hover:text-copper"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke dashboard
      </Link>
      <header className="mt-4">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-copper">
          Dashboard · HPP
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-[-0.04em] text-ink">
          HPP dari ledger · weighted-average
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">
          Setiap angka adalah nilai per unit dari batch produksi terakhir. Sumber ke
          ledger (bukan estimasi). Sinkronisasi ulang lewat{" "}
          <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px]">pnpm repair:hpp-cache --apply</code>.
        </p>
      </header>
      <div className="mt-6">
        <HppKpiTile data={data} />
      </div>
    </main>
  );
}