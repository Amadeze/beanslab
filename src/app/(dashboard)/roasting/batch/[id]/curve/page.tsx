import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  FLAG_REQUEST_HEADER,
  isFlagEnabledFromSnapshot,
  parseFlagRequestHeader,
} from "@/lib/featureFlags";
import { RoastCurveReplay, type RoastCurveData } from "@/components/roast/RoastCurveReplay";
import type { ParsedArtisanRoast } from "@/lib/artisan/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function isParsedArtisanRoast(value: unknown): value is ParsedArtisanRoast {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.beanTemperatureSeries) &&
    Array.isArray(candidate.environmentalTemperatureSeries)
  );
}

function toRoastCurveData(
  batchCode: string,
  parsed: ParsedArtisanRoast,
  matchScore: number | null,
  childTitle: string | null,
): RoastCurveData {
  return {
    title: childTitle ?? batchCode,
    durationSeconds: parsed.durationSeconds ?? undefined,
    beanTemperatureSeries: parsed.beanTemperatureSeries,
    environmentalTemperatureSeries: parsed.environmentalTemperatureSeries,
    events: parsed.events,
    matchScore,
  };
}

export default async function BatchCurvePage({ params }: PageProps) {
  const flagHeader = (await headers()).get(FLAG_REQUEST_HEADER);
  const flags = parseFlagRequestHeader(flagHeader);
  if (!isFlagEnabledFromSnapshot(flags, "roast-replay")) {
    notFound();
  }
  const { id } = await params;
  const user = await requireCurrentUser();

  const batch = await prisma.parentRoastingBatch.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      childBatches: {
        orderBy: { recordedAt: "asc" },
      },
    },
  });
  if (!batch) notFound();

  // Resolve reference: prefer an explicit reference profile; fall back to the
  // first child batch's parsed data (the parent is the "target" in that case).
  const referenceSnapshot = batch.profileSnapshot;
  const referenceParsed = isParsedArtisanRoast(referenceSnapshot) ? referenceSnapshot : null;
  const firstChildSnapshot = batch.childBatches[0]
    ? await prisma.childRoastingBatch
        .findUnique({
          where: { id: batch.childBatches[0].id },
          select: { matchDetails: true, matchScore: true },
        })
    : null;

  const firstChildSnapshotJson = firstChildSnapshot as unknown as {
    matchScore: number | null;
    matchDetails: { profileSnapshot?: unknown } | null;
  } | null;

  // matchDetails may embed a profile snapshot; if so prefer that for the
  // current (child) curve.
  const childParsed = (() => {
    const snapshot = firstChildSnapshotJson?.matchDetails?.profileSnapshot;
    return isParsedArtisanRoast(snapshot) ? snapshot : null;
  })();

  const childData: RoastCurveData | null = childParsed
    ? toRoastCurveData(
        batch.code,
        childParsed,
        firstChildSnapshotJson?.matchScore ?? null,
        `Child #1 · ${batch.code}`,
      )
    : null;

  const referenceData: RoastCurveData | null = referenceParsed
    ? toRoastCurveData(
        batch.code,
        referenceParsed,
        null,
        `Reference · ${batch.code}`,
      )
    : null;

  if (!childData && !referenceData) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-ink-tertiary">
          roastd.id · Roast curve
        </p>
        <h1 className="mt-6 font-heading text-3xl font-bold leading-[1.05] tracking-[-0.04em] text-ink">
          Belum ada data profil untuk batch ini
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-ink-secondary">
          Hubungkan mesin melalui Artisan atau Roastd Studio untuk mulai merekam kurva.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <header className="mb-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-copper">
          Roast curve · replay
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-[-0.04em] text-ink">
          {batch.code}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">
          Kurva roasting, RoR (rate of rise), dan perbandingan profil target.
        </p>
      </header>
      <div className="space-y-4">
        {childData && <RoastCurveReplay data={childData} reference={referenceData} showRoR replay />}
        {referenceData && !childData && (
          <RoastCurveReplay data={referenceData} showRoR={false} replay={false} />
        )}
      </div>
    </main>
  );
}