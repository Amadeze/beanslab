import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Download, Filter } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import {
  FLAG_REQUEST_HEADER,
  isFlagEnabledFromSnapshot,
  parseFlagRequestHeader,
} from "@/lib/featureFlags";
import { SCA_GRADE_LABEL, scaGrade, type ScaGrade } from "@/lib/cupping-intelligence";
import {
  CUPPING_CATEGORIES,
  loadConsensusForBatch,
  loadSessionSummary,
} from "@/lib/cupping-summary";
import { CuppingDescriptorFilter } from "./_components/CuppingDescriptorFilter";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ descriptor?: string }>;
}

function gradeBadgeClass(grade: ScaGrade): string {
  return SCA_GRADE_LABEL[grade].className;
}

function extractDescriptorKeywords(notes: string | null | undefined): string[] {
  if (!notes) return [];
  return notes
    .split(/[,\n;]/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 1 && part.length < 40);
}

export default async function CuppingSessionDetailPage({
  params,
  searchParams,
}: PageProps) {
  const flagHeader = (await headers()).get(FLAG_REQUEST_HEADER);
  const flags = parseFlagRequestHeader(flagHeader);
  if (!isFlagEnabledFromSnapshot(flags, "cupping-parity")) {
    notFound();
  }
  const { sessionId } = await params;
  const { descriptor: activeDescriptor } = await searchParams;

  const user = await requireCurrentUser();
  const summary = await loadSessionSummary(sessionId, user.tenantId);
  if (!summary) notFound();

  const session = await prisma.cuppingSession.findFirst({
    where: { id: sessionId, tenantId: user.tenantId },
    include: {
      batch: { select: { id: true, code: true } },
      product: { select: { id: true, name: true } },
      lot: { select: { id: true, batchCode: true } },
    },
  });
  if (!session) notFound();

  const consensus = session.batchId
    ? await loadConsensusForBatch(session.batchId, user.tenantId)
    : null;

  // Descriptors: union of all notes keywords from this session's category
  // notes. Cheap facet list, perfect for small per-session datasets.
  const fullScores = await prisma.cuppingScore.findMany({
    where: { sessionId },
    select: { category: true, notes: true },
  });
  const descriptorCounts = new Map<string, number>();
  for (const score of fullScores) {
    for (const keyword of extractDescriptorKeywords(score.notes)) {
      descriptorCounts.set(keyword, (descriptorCounts.get(keyword) ?? 0) + 1);
    }
  }
  const descriptors = [...descriptorCounts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count);

  const filteredCategories = activeDescriptor
    ? CUPPING_CATEGORIES.filter((category) => {
        const matching = fullScores.find(
          (entry) =>
            entry.category === category &&
            extractDescriptorKeywords(entry.notes).includes(activeDescriptor.toLowerCase()),
        );
        return Boolean(matching);
      })
    : CUPPING_CATEGORIES;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <Link
        href="/cupping"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-secondary hover:text-copper"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Daftar sesi
      </Link>
      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-copper">
            Cupping · {session.code}
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-[-0.04em] text-ink">
            {session.code}
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            {session.product?.name ?? "Tanpa produk"}{" "}
            {session.batch ? `· Batch ${session.batch.code}` : ""}{" "}
            {session.lot ? `· Lot ${session.lot.batchCode}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-card border px-3 py-1.5 text-xs font-bold ${gradeBadgeClass(scaGrade(summary.totalScore))}`}
          >
            T-score {summary.totalScore.toFixed(2)} · {summary.gradeLabel}
          </span>
          <a
            href={`/api/cupping/${sessionId}/export`}
            className="inline-flex h-9 items-center gap-2 rounded-card border border-border bg-card px-3 text-xs font-bold text-foreground hover:border-copper hover:text-copper"
          >
            <Download className="size-3.5" aria-hidden="true" /> Export PDF
          </a>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-card border border-border bg-card p-5 shadow-elevation-soft">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-tertiary">
            Penilai
          </p>
          <p className="mt-2 font-heading text-base font-bold text-ink">
            {summary.evaluatorName ?? "(tanpa nama)"}
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            {summary.date.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
          </p>
        </article>
        {consensus && consensus.sessionCount > 0 ? (
          <article className="rounded-card border border-copper/30 bg-copper-soft/40 p-5 shadow-elevation-soft">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-copper-strong">
              Konsensus lintas penilai
            </p>
            <p className="mt-2 font-heading text-base font-bold text-ink">
              {consensus.meanTotal?.toFixed(2)} rata-rata
            </p>
            <p className="mt-1 text-xs text-ink-secondary">
              {consensus.sessionCount} sesi · min {consensus.minTotal?.toFixed(2)} · max{" "}
              {consensus.maxTotal?.toFixed(2)} · agreement{" "}
              {consensus.agreementPercent ?? "-"}%
            </p>
          </article>
        ) : (
          <article className="rounded-card border border-border bg-card p-5 text-sm text-ink-secondary shadow-elevation-soft">
            <p>Tidak ada sesi lain untuk batch yang sama. Consensus muncul saat lebih dari satu penilai menilai batch ini.</p>
          </article>
        )}
      </section>

      <section className="mt-8" aria-labelledby="descriptors-heading">
        <div className="flex items-end gap-2">
          <Filter className="size-4 text-copper" aria-hidden="true" />
          <h2
            id="descriptors-heading"
            className="font-heading text-xl font-bold tracking-[-0.02em] text-ink"
          >
            Filter deskriptor
          </h2>
        </div>
        {descriptors.length === 0 ? (
          <p className="mt-3 text-sm text-ink-secondary">
            Belum ada deskriptor tercatat. Tambahkan kata kunci pada catatan kategori untuk memunculkannya.
          </p>
        ) : (
          <CuppingDescriptorFilter
            descriptors={descriptors}
            activeDescriptor={activeDescriptor ?? null}
            baseHref={`/cupping/${sessionId}`}
          />
        )}
      </section>

      <section className="mt-8" aria-labelledby="categories-heading">
        <h2
          id="categories-heading"
          className="font-heading text-xl font-bold tracking-[-0.02em] text-ink"
        >
          Skor per kategori
        </h2>
        <div className="mt-4 overflow-x-auto rounded-card border border-border bg-card shadow-elevation-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-tertiary">
                <th scope="col" className="px-5 py-3 text-left">Kategori</th>
                <th scope="col" className="px-5 py-3 text-right">Skor</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-4 text-center text-sm text-ink-secondary">
                    Tidak ada kategori cocok dengan deskriptor yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
                  <tr key={category} className="border-t border-border/60">
                    <th scope="row" className="px-5 py-3 text-left font-medium text-ink">
                      {category.replace(/_/g, " ")}
                    </th>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-ink">
                      {summary.categoryAverages[category].toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}