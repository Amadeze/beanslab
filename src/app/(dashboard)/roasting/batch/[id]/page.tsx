import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { BatchRecapClient } from "./_components/BatchRecapClient";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function BatchRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("OWNER", "MANAGER", "OPERATOR");
  const { id } = await params;

  const batch = await prisma.parentRoastingBatch.findUnique({
    where: { id, tenantId: user.tenantId },
    include: {
      childBatches: { orderBy: { recordedAt: "asc" } },
    },
  });

  if (!batch) notFound();

  // Fetch related data separately
  const [inputProduct, outputProduct, machine, createdBy] = await Promise.all([
    prisma.product.findUnique({ where: { id: batch.inputProductId }, select: { id: true, name: true } }),
    prisma.product.findUnique({ where: { id: batch.outputProductId }, select: { id: true, name: true } }),
    batch.machineId ? prisma.machine.findUnique({ where: { id: batch.machineId }, select: { id: true, name: true, capacityKg: true } }) : null,
    prisma.user.findUnique({ where: { id: batch.createdById }, select: { id: true, name: true } }),
  ]);

  // Fetch roast data for each child batch
  const roastIds = batch.childBatches.filter((c) => c.roastId).map((c) => c.roastId!);

  const roasts = roastIds.length > 0
    ? await prisma.roast.findMany({
        where: { id: { in: roastIds } },
        select: {
          id: true, title: true, roastDate: true, duration: true,
          chargeTemperature: true, dropTemperature: true,
          firstCrackStartTime: true, firstCrackEndTime: true, secondCrackStartTime: true,
          greenWeightGrams: true, roastedWeightGrams: true, lossPercent: true,
          beanTemperatureSeries: true, environmentalTemperatureSeries: true,
          events: true, metadata: true,
        },
      })
    : [];

  const roastMap = new Map(roasts.map((r) => [r.id, r]));

  // Calculate recap stats
  const totalInputKg = Number(batch.targetWeightKg);
  const totalOutputKg = batch.actualOutputKg ? Number(batch.actualOutputKg) : null;
  const totalLossPercent = batch.totalShrinkagePercent ? Number(batch.totalShrinkagePercent) : null;

  const childCount = batch.childBatches.length;
  const completedChildren = batch.childBatches.filter((c) => c.roastId);
  const pendingChildren = batch.childBatches.filter((c) => !c.roastId);

  // Aggregate roast data
  let totalRoastedGrams = 0;
  let totalGreenGrams = 0;
  let totalDuration = 0;
  let roastCount = 0;

  for (const child of completedChildren) {
    const r = child.roastId ? roastMap.get(child.roastId) : null;
    if (r) {
      if (r.roastedWeightGrams) totalRoastedGrams += r.roastedWeightGrams;
      if (r.greenWeightGrams) totalGreenGrams += r.greenWeightGrams;
      if (r.duration) totalDuration += r.duration;
      roastCount++;
    }
  }

  const avgDuration = roastCount > 0 ? Math.round(totalDuration / roastCount) : null;
  const computedLossPercent = totalGreenGrams > 0
    ? Math.round(((totalGreenGrams - totalRoastedGrams) / totalGreenGrams) * 100 * 10) / 10
    : null;

  const recapData = {
    id: batch.id,
    code: batch.code,
    status: batch.status,
    notes: batch.notes,
    createdAt: batch.createdAt.toISOString(),
    completedAt: batch.completedAt?.toISOString() ?? null,
    inputProduct: inputProduct ?? { id: batch.inputProductId, name: "Unknown" },
    outputProduct: outputProduct ?? { id: batch.outputProductId, name: "Unknown" },
    machine: machine ? { ...machine, capacityKg: machine.capacityKg ? Number(machine.capacityKg) : null } : null,
    createdBy: createdBy ?? { id: batch.createdById, name: "Unknown" },
    targetWeightKg: totalInputKg,
    actualOutputKg: totalOutputKg,
    totalLossPercent: totalLossPercent ?? computedLossPercent,
    childCount,
    completedCount: completedChildren.length,
    pendingCount: pendingChildren.length,
    children: batch.childBatches.map((c, idx) => {
      const r = c.roastId ? roastMap.get(c.roastId) : null;
      return {
        id: c.id,
        index: idx + 1,
        roastId: c.roastId,
        roastDuration: c.roastDuration,
        dropTemp: c.dropTemp ? Number(c.dropTemp) : null,
        recordedAt: c.recordedAt.toISOString(),
        roast: r
          ? {
              id: r.id, title: r.title,
              roastDate: r.roastDate?.toISOString() ?? null,
              duration: r.duration,
              chargeTemperature: r.chargeTemperature,
              dropTemperature: r.dropTemperature,
              firstCrackStartTime: r.firstCrackStartTime,
              firstCrackEndTime: r.firstCrackEndTime,
              secondCrackStartTime: r.secondCrackStartTime,
              greenWeightGrams: r.greenWeightGrams,
              roastedWeightGrams: r.roastedWeightGrams,
              lossPercent: r.lossPercent,
              beanTemperatureSeries: r.beanTemperatureSeries as any,
              environmentalTemperatureSeries: r.environmentalTemperatureSeries as any,
              events: r.events as any,
              metadata: r.metadata as any,
            }
          : null,
      };
    }),
    summary: {
      totalGreenGrams,
      totalRoastedGrams,
      avgDuration,
      roastCount,
    },
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={`Rekap Batch ${batch.code}`}
        eyebrow="Roasting"
        description={`${inputProduct?.name} → ${outputProduct?.name}`}
        stage="roasting"
      />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
          <BatchRecapClient data={recapData} />
        </div>
      </div>
    </div>
  );
}
