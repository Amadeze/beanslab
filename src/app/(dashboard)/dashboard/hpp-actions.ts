import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export interface HppKpiItem {
  productId: string;
  productCode: string;
  productName: string;
  /** HPP per unit from the cached `Product.lastHpp` (ledger-rebuilt via repair script). */
  lastHpp: number | null;
  /** HPP from the most recent completed production batch (the source of truth). */
  latestBatchHpp: number | null;
  /** Most recent completed batch id, for "view source" link. */
  latestBatchId: string | null;
  /** Most recent completed batch date. */
  latestBatchDate: Date | null;
  /** Whether the cached `lastHpp` matches the latest batch. */
  inSync: boolean;
}

export interface HppKpi {
  items: HppKpiItem[];
  meanHpp: number | null;
  driftCount: number;
  /** ISO timestamp of the HPP rebuild script that should run on release. */
  lastRebuildHint: string;
}

export async function getHppKpi(): Promise<HppKpi> {
  const user = await requireRole("OWNER", "MANAGER");
  const products = await prisma.product.findMany({
    where: { tenantId: user.tenantId, type: "FINISHED_GOODS", isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      lastHpp: true,
      productionBatches: {
        where: { status: "COMPLETED" },
        orderBy: [{ producedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { id: true, hppPerUnit: true, producedAt: true, createdAt: true },
      },
    },
    orderBy: { code: "asc" },
  });

  const items: HppKpiItem[] = products.map((product) => {
    const latest = product.productionBatches[0];
    const latestValue = latest?.hppPerUnit ? Number(latest.hppPerUnit) : null;
    const cachedValue = product.lastHpp ? Number(product.lastHpp) : null;
    return {
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      lastHpp: cachedValue,
      latestBatchHpp: latestValue,
      latestBatchId: latest?.id ?? null,
      latestBatchDate: latest?.producedAt ?? latest?.createdAt ?? null,
      inSync: latestValue != null && cachedValue != null
        ? Math.abs(latestValue - cachedValue) < 0.01
        : latestValue === cachedValue,
    };
  });

  const meanHpp = items.length > 0
    ? items.reduce((acc, item) => acc + (item.lastHpp ?? 0), 0) / items.length
    : null;
  const driftCount = items.filter((item) => !item.inSync).length;
  return {
    items,
    meanHpp,
    driftCount,
    lastRebuildHint: "pnpm repair:hpp-cache --apply",
  };
}