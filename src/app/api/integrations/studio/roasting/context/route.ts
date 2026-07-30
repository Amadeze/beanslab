import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateConnector } from "@/lib/artisan/connector-auth";
import { SelectStudioRoastContextSchema } from "@/lib/artisan/types";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Autentikasi Studio gagal." } },
    { status: 401 },
  );
}

function profilePoints(beanSeries: unknown, environmentSeries: unknown) {
  const bySecond = new Map<number, { second: number; bt: number | null; et: number | null; ror: number | null }>();
  const append = (series: unknown, key: "bt" | "et") => {
    if (!Array.isArray(series)) return;
    for (const item of series) {
      if (!item || typeof item !== "object") continue;
      const second = Number((item as Record<string, unknown>).second);
      const value = Number((item as Record<string, unknown>).value);
      if (!Number.isFinite(second) || !Number.isFinite(value)) continue;
      const point = bySecond.get(second) ?? { second, bt: null, et: null, ror: null };
      point[key] = value;
      bySecond.set(second, point);
    }
  };
  append(beanSeries, "bt");
  append(environmentSeries, "et");

  const points = [...bySecond.values()].sort((a, b) => a.second - b.second);
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = [...points.slice(0, index)].reverse().find((point) => point.bt != null);
    if (current.bt == null || previous?.bt == null || current.second <= previous.second) continue;
    current.ror = Math.round((((current.bt - previous.bt) / (current.second - previous.second)) * 60) * 10) / 10;
  }
  return points;
}

function profileEvents(value: unknown) {
  if (!Array.isArray(value)) return [];
  const accepted = new Set(["CHARGE", "TP", "DRY_END", "FCs", "FCe", "SCs", "DROP"]);
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const event = item as Record<string, unknown>;
    const type = String(event.type ?? "");
    const second = Number(event.second);
    if (!accepted.has(type) || !Number.isFinite(second)) return [];
    const rawValue = typeof event.value === "string" ? event.value.split("/")[0] : event.value;
    const bt = Number(rawValue);
    return [{ type, second, bt: Number.isFinite(bt) ? bt : null }];
  });
}

function serializeProfile(profile: {
  id: string;
  title: string | null;
  machineId: string;
  duration: number | null;
  greenWeightGrams: number | null;
  beanTemperatureSeries: unknown;
  environmentalTemperatureSeries: unknown;
  events: unknown;
}) {
  return {
    id: profile.id,
    title: profile.title || "Profil tanpa nama",
    machineId: profile.machineId,
    durationSeconds: profile.duration,
    greenWeightGrams: profile.greenWeightGrams,
    points: profilePoints(profile.beanTemperatureSeries, profile.environmentalTemperatureSeries),
    events: profileEvents(profile.events),
  };
}

function targetChargeWeightGrams(batch: {
  targetWeightKg: unknown;
  machine: { capacityKg: unknown } | null;
  childBatches: Array<{ roastId?: string | null }>;
}) {
  const totalKg = Number(batch.targetWeightKg);
  const capacityKg = Number(batch.machine?.capacityKg ?? 0);
  const plannedChildren = batch.childBatches.length > 0
    ? batch.childBatches.length
    : capacityKg > 0
      ? Math.max(1, Math.ceil(totalKg / capacityKg))
      : 1;
  return Math.round((totalKg / plannedChildren) * 1000);
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  try {
    const auth = await authenticateConnector(req.headers.get("authorization"));
    if (!auth) return unauthorized();

    const [batches, profiles, greenBeans, machine] = await Promise.all([
    prisma.parentRoastingBatch.findMany({
      where: {
        tenantId: auth.tenantId,
        machineId: auth.machineId,
        status: "PENDING",
        childBatches: { some: { roastId: null } },
      },
      select: {
        id: true,
        code: true,
        targetWeightKg: true,
        referenceRoastId: true,
        inputProduct: { select: { name: true } },
        machine: { select: { capacityKg: true } },
        childBatches: { select: { id: true, roastId: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 30,
    }),
      prisma.roast.findMany({
      where: {
        tenantId: auth.tenantId,
        machineId: auth.machineId,
      },
      select: {
        id: true,
        title: true,
        roastDate: true,
        duration: true,
        greenWeightGrams: true,
      },
      orderBy: { roastDate: "desc" },
        take: 30,
      }),
      prisma.product.findMany({
        where: {
          tenantId: auth.tenantId,
          type: "GREEN_BEAN",
          isActive: true,
          stockKg: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          origin: true,
          stockKg: true,
          lots: {
            where: { consumedAt: null },
            orderBy: [
              { expiryDate: { sort: "asc", nulls: "last" } },
              { receivedAt: "asc" },
            ],
            take: 5,
            select: {
              batchCode: true,
              expiryDate: true,
              quantityKg: true,
              inventoryLedgers: {
                select: { entryType: true, quantityKg: true },
              },
            },
          },
          roastingInputs: {
            where: {
              machineId: auth.machineId,
              referenceRoastId: { not: null },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              referenceRoastId: true,
              outputProduct: { select: { roastLevel: true } },
            },
          },
        },
        orderBy: { name: "asc" },
        take: 100,
      }),
      prisma.machine.findFirst({
        where: { id: auth.machineId, tenantId: auth.tenantId, isActive: true },
        select: { capacityKg: true },
      }),
    ]);

    return NextResponse.json({
      batches: batches.map((batch) => ({
        id: batch.id,
        code: batch.code,
        inputProductName: batch.inputProduct.name,
        targetWeightGrams: targetChargeWeightGrams(batch),
        pendingChildCount: batch.childBatches.filter((child) => child.roastId == null).length,
        referenceProfileId: batch.referenceRoastId,
      })),
      profiles: profiles.map((profile) => ({
        id: profile.id,
        title: profile.title || "Profil tanpa nama",
        roastDate: profile.roastDate?.toISOString() ?? null,
        durationSeconds: profile.duration,
        greenWeightGrams: profile.greenWeightGrams,
      })),
      machineCapacityKg: Number(machine?.capacityKg ?? 0) || null,
      greenBeans: greenBeans.map((product) => {
        const nextLot = product.lots
          .map((lot) => {
            const ledgerBalance = lot.inventoryLedgers.reduce((total, entry) => {
              const quantity = Number(entry.quantityKg ?? 0);
              return total + (entry.entryType === "IN" ? quantity : -quantity);
            }, 0);
            return {
              lotNumber: lot.batchCode,
              expiryDate: lot.expiryDate?.toISOString() ?? null,
              remainingKg: Math.max(0, lot.inventoryLedgers.length ? ledgerBalance : Number(lot.quantityKg)),
            };
          })
          .find((lot) => lot.remainingKg > 0.000_001) ?? null;
        const history = product.roastingInputs[0];
        return {
          id: product.id,
          name: product.name,
          origin: product.origin,
          stockKg: Number(product.stockKg),
          nextLot,
          suggestedRoastLevel: history?.outputProduct.roastLevel ?? "MEDIUM",
          recommendedProfileId: history?.referenceRoastId ?? null,
        };
      }),
    });
  } catch (error) {
    logServerError("studio.roasting-context.get", error, { requestId });
    return internalErrorResponse(requestId, "Konteks roasting gagal dimuat.");
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  try {
    const auth = await authenticateConnector(req.headers.get("authorization"));
    if (!auth) return unauthorized();

  const parsed = SelectStudioRoastContextSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_CONTEXT", message: "Batch atau profil acuan tidak valid." } },
      { status: 400 },
    );
  }

  const batch = await prisma.parentRoastingBatch.findFirst({
    where: {
      id: parsed.data.batchId,
      tenantId: auth.tenantId,
      machineId: auth.machineId,
      status: "PENDING",
    },
    select: {
      id: true,
      code: true,
      targetWeightKg: true,
      inputProduct: { select: { name: true } },
      machine: { select: { capacityKg: true } },
      childBatches: { select: { roastId: true } },
      referenceRoast: {
        select: {
          id: true,
          title: true,
          machineId: true,
          duration: true,
          greenWeightGrams: true,
          beanTemperatureSeries: true,
          environmentalTemperatureSeries: true,
          events: true,
        },
      },
    },
  });

  if (!batch) {
    return NextResponse.json(
      { error: { code: "CONTEXT_NOT_FOUND", message: "Batch tidak tersedia untuk mesin Studio ini." } },
      { status: 404 },
    );
  }
  if (!batch.referenceRoast) {
    return NextResponse.json(
      {
        error: {
          code: "REFERENCE_NOT_ASSIGNED",
          message: `Atur profil acuan untuk ${batch.code} dari web, lalu muat ulang Studio.`,
        },
      },
      { status: 409 },
    );
  }

    return NextResponse.json({
      selection: {
        batchId: batch.id,
        batchCode: batch.code,
        inputProductName: batch.inputProduct.name,
        targetWeightGrams: targetChargeWeightGrams(batch),
        referenceProfile: serializeProfile(batch.referenceRoast),
      },
    });
  } catch (error) {
    logServerError("studio.roasting-context.select", error, { requestId });
    return internalErrorResponse(requestId, "Profil acuan gagal dipilih.");
  }
}
