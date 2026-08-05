import type { Prisma, PrismaClient } from "@prisma/client";

export type SupplyClient = PrismaClient | Prisma.TransactionClient;

export type BackfillLog = (line: string) => void;

export type SupplyBackfillSummary = {
  tenantsProcessed: number;
  supplyItemsCreated: number;
  recipeLinksCreated: number;
};

export type SupplyBackfillIssue = {
  code: string;
  tenantCode: string;
  itemCode: string;
  message: string;
};

export type SupplyBackfillValidation = {
  ok: boolean;
  issues: SupplyBackfillIssue[];
  packagingCount: number;
  supplyItemCount: number;
  recipeCount: number;
};

export class SupplyBackfillCutoverBlockedError extends Error {
  readonly issues: SupplyBackfillIssue[];

  constructor(issues: SupplyBackfillIssue[]) {
    super(`Supply backfill validation failed with ${issues.length} issue(s)`);
    this.name = "SupplyBackfillCutoverBlockedError";
    this.issues = issues;
  }
}

const LEDGER_EPSILON = 0.001;

async function packagingLedgerSums(
  client: SupplyClient,
  tenantId: string,
): Promise<Map<string, number>> {
  const rows = await client.$queryRaw<{ id: string; total: number }[]>`
    SELECT
      il."packagingId" AS id,
      COALESCE(SUM(
        CASE WHEN il."entryType" = 'IN' THEN il."quantityUnit" ELSE -il."quantityUnit" END
      ), 0)::float AS total
    FROM inventory_ledger il
    WHERE il."tenantId" = ${tenantId} AND il."packagingId" IS NOT NULL
    GROUP BY il."packagingId"
  `;
  return new Map(rows.map((r) => [r.id, Number(r.total)]));
}

async function supplyLedgerSums(
  client: SupplyClient,
  tenantId: string,
): Promise<Map<string, number>> {
  const rows = await client.$queryRaw<{ id: string; total: number }[]>`
    SELECT
      il."supplyItemId" AS id,
      COALESCE(SUM(
        CASE WHEN il."entryType" = 'IN' THEN il."supplyQuantity" ELSE -il."supplyQuantity" END
      ), 0)::float AS total
    FROM inventory_ledger il
    WHERE il."tenantId" = ${tenantId} AND il."supplyItemId" IS NOT NULL
    GROUP BY il."supplyItemId"
  `;
  return new Map(rows.map((r) => [r.id, Number(r.total)]));
}

async function backfillRecipeLinks(
  client: SupplyClient,
  tenantId: string,
): Promise<number> {
  const recipes = await client.recipe.findMany({
    where: { tenantId },
    select: { id: true, packagingId: true },
  });

  let linked = 0;
  for (const recipe of recipes) {
    const packaging = await client.packaging.findUnique({
      where: { id: recipe.packagingId },
      select: { supplyItemId: true },
    });
    const supplyItemId = packaging?.supplyItemId;
    if (!supplyItemId) continue;

    const exists = await client.recipeSupplyItem.findUnique({
      where: { recipeId_supplyItemId: { recipeId: recipe.id, supplyItemId } },
      select: { id: true },
    });
    if (exists) continue;

    await client.recipeSupplyItem.create({
      data: { recipeId: recipe.id, supplyItemId, quantityPerUnit: 1, tenantId },
    });
    linked++;
  }
  return linked;
}

export async function backfillSupplyItems(
  client: SupplyClient,
  onLog: BackfillLog = () => {},
): Promise<SupplyBackfillSummary> {
  const tenants = await client.tenant.findMany({
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });

  let supplyItemsCreated = 0;
  let recipeLinksCreated = 0;

  for (const tenant of tenants) {
    const packagings = await client.packaging.findMany({
      where: { tenantId: tenant.id, supplyItemId: null },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        weightGrams: true,
        costPerUnit: true,
        avgCostPerUnit: true,
        isActive: true,
        reorderAlertEnabled: true,
        leadTimeDays: true,
        safetyStockQuantity: true,
        reorderLookbackDays: true,
      },
    });

    if (packagings.length === 0) {
      recipeLinksCreated += await backfillRecipeLinks(client, tenant.id);
      continue;
    }

    const ledgerSums = await packagingLedgerSums(client, tenant.id);
    const createdHere: string[] = [];

    for (const packaging of packagings) {
      const supplyCode = `SUP-${packaging.code}`;
      const clash = await client.inventorySupplyItem.findUnique({
        where: { tenantId_code: { tenantId: tenant.id, code: supplyCode } },
        select: { id: true },
      });
      if (clash) {
        throw new Error(
          `[supply-backfill] code conflict ${tenant.code}/${supplyCode}: supply item already exists — no overwrite`,
        );
      }

      const stockQuantity = ledgerSums.get(packaging.id) ?? 0;

      await client.$transaction(async (tx) => {
        const supply = await tx.inventorySupplyItem.create({
          data: {
            code: supplyCode,
            name: packaging.name,
            category: "PACKAGING",
            baseUnit: "PCS",
            trackLot: true,
            shelfLifeDays: null,
            consumableInProduction: false,
            includeInProductHpp: false,
            isSellable: false,
            capacityGrams: null,
            tareWeightGrams: Number(packaging.weightGrams),
            costPerUnit: Number(packaging.costPerUnit),
            avgCostPerUnit: Number(packaging.avgCostPerUnit ?? 0),
            isActive: packaging.isActive,
            stockQuantity,
            reorderAlertEnabled: packaging.reorderAlertEnabled,
            leadTimeDays: packaging.leadTimeDays,
            safetyStockQuantity: packaging.safetyStockQuantity,
            reorderLookbackDays: packaging.reorderLookbackDays,
            tenantId: tenant.id,
          },
        });
        await tx.packaging.update({
          where: { id: packaging.id },
          data: { supplyItemId: supply.id },
        });
      });

      createdHere.push(packaging.code);
      supplyItemsCreated++;
    }

    onLog(`  ${tenant.code}: created ${createdHere.length} supply item(s)`);
    recipeLinksCreated += await backfillRecipeLinks(client, tenant.id);
  }

  onLog(
    `Backfill: ${tenants.length} tenant(s), ${supplyItemsCreated} supply item(s), ${recipeLinksCreated} recipe link(s)`,
  );
  return { tenantsProcessed: tenants.length, supplyItemsCreated, recipeLinksCreated };
}

export async function validateSupplyBackfill(
  client: SupplyClient,
  onLog: BackfillLog = () => {},
): Promise<SupplyBackfillValidation> {
  const tenants = await client.tenant.findMany({
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });

  const issues: SupplyBackfillIssue[] = [];
  let packagingCount = 0;
  let supplyItemCount = 0;
  let recipeCount = 0;

  for (const tenant of tenants) {
    const packagings = await client.packaging.findMany({
      where: { tenantId: tenant.id },
      include: {
        supplyItem: {
          select: {
            id: true,
            code: true,
            tenantId: true,
            category: true,
            stockQuantity: true,
          },
        },
      },
      orderBy: { code: "asc" },
    });

    if (packagings.length === 0) continue;
    packagingCount += packagings.length;

    const ledgerPerPackaging = await packagingLedgerSums(client, tenant.id);
    const ledgerPerSupply = await supplyLedgerSums(client, tenant.id);

    for (const packaging of packagings) {
      const supplyItem = packaging.supplyItem;
      if (!supplyItem) {
        issues.push({
          code: "UNMAPPED_PACKAGING",
          tenantCode: tenant.code,
          itemCode: packaging.code,
          message: "packaging tanpa supply item",
        });
        continue;
      }
      if (supplyItem.tenantId !== tenant.id) {
        issues.push({
          code: "TENANT_MISMATCH",
          tenantCode: tenant.code,
          itemCode: packaging.code,
          message: `mapping lintas tenant ke ${supplyItem.code}`,
        });
      }
      if (supplyItem.category !== "PACKAGING") {
        issues.push({
          code: "MAPPING_CATEGORY",
          tenantCode: tenant.code,
          itemCode: packaging.code,
          message: `supply item ${supplyItem.code} bukan PACKAGING`,
        });
      }

      const cachedUnit = Number(packaging.stockUnit);
      const ledgerUnit = Math.round(ledgerPerPackaging.get(packaging.id) ?? 0);
      if (cachedUnit !== ledgerUnit) {
        issues.push({
          code: "LEDGER_CACHE_MISMATCH",
          tenantCode: tenant.code,
          itemCode: packaging.code,
          message: `stockUnit=${cachedUnit} vs ledger=${ledgerUnit}`,
        });
      }

      const expectedStock =
        (ledgerPerPackaging.get(packaging.id) ?? 0) +
        (ledgerPerSupply.get(supplyItem.id) ?? 0);
      const actualStock = Number(supplyItem.stockQuantity);
      if (Math.abs(actualStock - expectedStock) > LEDGER_EPSILON) {
        issues.push({
          code: "STOCK_QTY_MISMATCH",
          tenantCode: tenant.code,
          itemCode: supplyItem.code,
          message: `stockQuantity=${actualStock} vs ledger=${expectedStock}`,
        });
      }
    }

    const supplyItems = await client.inventorySupplyItem.findMany({
      where: { tenantId: tenant.id },
      select: { code: true },
    });
    supplyItemCount += supplyItems.length;
    const seen = new Map<string, number>();
    for (const item of supplyItems) {
      seen.set(item.code, (seen.get(item.code) ?? 0) + 1);
    }
    for (const [code, count] of seen) {
      if (count > 1) {
        issues.push({
          code: "DUPLICATE_CODE",
          tenantCode: tenant.code,
          itemCode: code,
          message: `${count}x kode duplikat`,
        });
      }
    }

    const recipes = await client.recipe.findMany({
      where: { tenantId: tenant.id },
      include: {
        packaging: { select: { supplyItemId: true } },
        supplyItems: { select: { supplyItemId: true } },
      },
    });
    recipeCount += recipes.length;
    for (const recipe of recipes) {
      const mappedSupplyItemId = recipe.packaging.supplyItemId;
      if (!mappedSupplyItemId) continue;
      const hasLink = recipe.supplyItems.some(
        (s) => s.supplyItemId === mappedSupplyItemId,
      );
      if (!hasLink) {
        issues.push({
          code: "RECIPE_LINK_MISSING",
          tenantCode: tenant.code,
          itemCode: recipe.code,
          message: "resep tanpa RecipeSupplyItem untuk packaging ter-mapping",
        });
      }
    }

    const ledgerXor = await client.$queryRaw<{ refType: string; refId: string }[]>`
      SELECT il."refType", il."refId"
      FROM inventory_ledger il
      WHERE il."tenantId" = ${tenant.id}
        AND il."packagingId" IS NOT NULL
        AND il."supplyItemId" IS NOT NULL
      LIMIT 25
    `;
    for (const violation of ledgerXor) {
      issues.push({
        code: "XOR_VIOLATION",
        tenantCode: tenant.code,
        itemCode: violation.refId.slice(0, 12),
        message: `ledger ref ${violation.refType} memiliki packagingId + supplyItemId`,
      });
    }

    const lotXor = await client.$queryRaw<{ batchCode: string }[]>`
      SELECT l."batchCode"
      FROM lots l
      WHERE l."tenantId" = ${tenant.id}
        AND l."packagingId" IS NOT NULL
        AND l."supplyItemId" IS NOT NULL
      LIMIT 25
    `;
    for (const violation of lotXor) {
      issues.push({
        code: "XOR_VIOLATION",
        tenantCode: tenant.code,
        itemCode: violation.batchCode,
        message: "lot memiliki packagingId + supplyItemId",
      });
    }

    onLog(
      `  ${tenant.code}: ${packagings.length} packaging, ${supplyItems.length} supply item`,
    );
  }

  const ok = issues.length === 0;
  onLog(`Validation: ${ok ? "OK" : `${issues.length} issue(s)`}`);

  return { ok, issues, packagingCount, supplyItemCount, recipeCount };
}

export async function runSupplyBackfillCutover(
  client: SupplyClient,
  onLog: BackfillLog = () => {},
): Promise<{ summary: SupplyBackfillSummary; validation: SupplyBackfillValidation }> {
  const summary = await backfillSupplyItems(client, onLog);
  const validation = await validateSupplyBackfill(client, onLog);
  if (!validation.ok) {
    throw new SupplyBackfillCutoverBlockedError(validation.issues);
  }
  return { summary, validation };
}