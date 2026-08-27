export type DemandLine = {
  productId: string;
  quantity: number;
};

export type StockCommitment = {
  productId: string;
  quantity: number;
};

export type IncomingStock = {
  productId: string;
  quantity: number;
};

export type PlanningProduct = {
  id: string;
  code: string;
  name: string;
  kind: "FINISHED_GOODS" | "ROASTED_BEAN" | "GREEN_BEAN";
  onHand: number;
  safetyStock: number;
  leadTimeDays: number;
  averageDailyDemand: number;
  materialOrigin?: "INTERNAL_ROAST" | "PURCHASED_ROASTED" | null;
  sourceGreenBeanId?: string | null;
};

export type PlanningSupply = {
  id: string;
  code: string;
  name: string;
  baseUnit: string;
  onHand: number;
  safetyStock: number;
  leadTimeDays: number;
  averageDailyDemand: number;
};

export type PlanningRecipe = {
  productId: string;
  outputGrams: number;
  coffeeItems: Array<{ productId: string; quantityPerUnitKg: number }>;
  supplyItems: Array<{ supplyItemId: string; quantityPerUnit: number }>;
};

export type DemandPlanningInput = {
  products: PlanningProduct[];
  supplies: PlanningSupply[];
  recipes: PlanningRecipe[];
  openDemand: DemandLine[];
  commitments: StockCommitment[];
  incomingProducts: IncomingStock[];
  incomingSupplies: Array<{ supplyItemId: string; quantity: number }>;
  yieldByRoastedProduct: Array<{ productId: string; yieldRate: number }>;
};

export type FinishedGoodsPlan = {
  productId: string;
  code: string;
  name: string;
  openDemand: number;
  committed: number;
  uncommittedDemand: number;
  onHand: number;
  onOrder: number;
  inventoryPosition: number;
  forecastDuringLeadTime: number;
  safetyStock: number;
  suggestedProduction: number;
  hasRecipe: boolean;
};

export type MaterialPlan = {
  productId: string;
  code: string;
  name: string;
  kind: "ROASTED_BEAN" | "GREEN_BEAN";
  required: number;
  committed: number;
  onHand: number;
  onOrder: number;
  safetyStock: number;
  shortage: number;
  suggestedRoastInputKg: number;
  sourceGreenBeanId: string | null;
  yieldRate: number | null;
};

export type SupplyPlan = {
  supplyItemId: string;
  code: string;
  name: string;
  baseUnit: string;
  required: number;
  onHand: number;
  onOrder: number;
  safetyStock: number;
  forecastDuringLeadTime: number;
  shortage: number;
};

export type DemandPlan = {
  finishedGoods: FinishedGoodsPlan[];
  materials: MaterialPlan[];
  supplies: SupplyPlan[];
  summary: {
    productionSkuCount: number;
    productionUnits: number;
    roastSkuCount: number;
    roastOutputKg: number;
    purchaseSkuCount: number;
  };
};

export const DEFAULT_ROAST_YIELD = 0.82;

function aggregate<T>(
  rows: T[],
  key: (row: T) => string,
  value: (row: T) => number,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    result.set(key(row), (result.get(key(row)) ?? 0) + Math.max(0, value(row)));
  }
  return result;
}

function safeYield(value: number | undefined): number {
  // A missing or implausible history must never create an unsafe zero-input plan.
  return value && value >= 0.5 && value <= 1 ? value : DEFAULT_ROAST_YIELD;
}

/**
 * Builds an auditable, read-only operations plan from canonical transactions.
 * It never books stock, creates a roast, or changes an order automatically.
 */
export function buildDemandPlan(input: DemandPlanningInput): DemandPlan {
  const demand = aggregate(input.openDemand, (row) => row.productId, (row) => row.quantity);
  const commitments = aggregate(input.commitments, (row) => row.productId, (row) => row.quantity);
  const incomingProducts = aggregate(input.incomingProducts, (row) => row.productId, (row) => row.quantity);
  const incomingSupplies = aggregate(input.incomingSupplies, (row) => row.supplyItemId, (row) => row.quantity);
  const recipes = new Map(input.recipes.map((recipe) => [recipe.productId, recipe]));
  const yields = new Map(input.yieldByRoastedProduct.map((row) => [row.productId, row.yieldRate]));

  const finishedGoods = input.products
    .filter((product) => product.kind === "FINISHED_GOODS")
    .map<FinishedGoodsPlan>((product) => {
      const openDemand = demand.get(product.id) ?? 0;
      const committed = Math.min(openDemand, commitments.get(product.id) ?? 0);
      const uncommittedDemand = Math.max(0, openDemand - committed);
      const onOrder = incomingProducts.get(product.id) ?? 0;
      const inventoryPosition = product.onHand + onOrder - committed;
      const forecastDuringLeadTime = product.averageDailyDemand * product.leadTimeDays;
      // Confirmed demand wins over the statistical signal; it is not counted twice.
      const uncoveredDemand = Math.max(uncommittedDemand, forecastDuringLeadTime);
      const suggestedProduction = Math.ceil(Math.max(
        0,
        product.safetyStock + uncoveredDemand - inventoryPosition,
      ));

      return {
        productId: product.id,
        code: product.code,
        name: product.name,
        openDemand,
        committed,
        uncommittedDemand,
        onHand: product.onHand,
        onOrder,
        inventoryPosition,
        forecastDuringLeadTime,
        safetyStock: product.safetyStock,
        suggestedProduction,
        hasRecipe: recipes.has(product.id),
      };
    })
    .sort((a, b) => b.suggestedProduction - a.suggestedProduction || a.name.localeCompare(b.name));

  const roastedRequired = new Map<string, number>();
  const supplyRequired = new Map<string, number>();
  for (const plan of finishedGoods) {
    if (plan.suggestedProduction <= 0) continue;
    const recipe = recipes.get(plan.productId);
    if (!recipe) continue;
    for (const item of recipe.coffeeItems) {
      roastedRequired.set(
        item.productId,
        (roastedRequired.get(item.productId) ?? 0) + item.quantityPerUnitKg * plan.suggestedProduction,
      );
    }
    for (const item of recipe.supplyItems) {
      supplyRequired.set(
        item.supplyItemId,
        (supplyRequired.get(item.supplyItemId) ?? 0) + item.quantityPerUnit * plan.suggestedProduction,
      );
    }
  }

  const materials = input.products
    .filter((product) => product.kind === "ROASTED_BEAN")
    .map<MaterialPlan>((product) => {
      const required = roastedRequired.get(product.id) ?? 0;
      const committed = commitments.get(product.id) ?? 0;
      const onOrder = incomingProducts.get(product.id) ?? 0;
      const shortage = Math.max(0, required + committed + product.safetyStock - product.onHand - onOrder);
      const canRoast = product.materialOrigin === "INTERNAL_ROAST" && product.sourceGreenBeanId;
      const yieldRate = canRoast ? safeYield(yields.get(product.id)) : null;
      return {
        productId: product.id,
        code: product.code,
        name: product.name,
        kind: "ROASTED_BEAN",
        required,
        committed,
        onHand: product.onHand,
        onOrder,
        safetyStock: product.safetyStock,
        shortage,
        suggestedRoastInputKg: yieldRate ? shortage / yieldRate : 0,
        sourceGreenBeanId: product.sourceGreenBeanId ?? null,
        yieldRate,
      };
    })
    .filter((plan) => plan.required > 0 || plan.committed > 0 || plan.shortage > 0)
    .sort((a, b) => b.shortage - a.shortage || a.name.localeCompare(b.name));

  const greenDemand = new Map<string, number>();
  for (const material of materials) {
    if (material.sourceGreenBeanId && material.suggestedRoastInputKg > 0) {
      greenDemand.set(
        material.sourceGreenBeanId,
        (greenDemand.get(material.sourceGreenBeanId) ?? 0) + material.suggestedRoastInputKg,
      );
    }
  }
  for (const product of input.products.filter((row) => row.kind === "GREEN_BEAN")) {
    const required = greenDemand.get(product.id) ?? 0;
    if (required <= 0) continue;
    const onOrder = incomingProducts.get(product.id) ?? 0;
    const shortage = Math.max(0, required + product.safetyStock - product.onHand - onOrder);
    materials.push({
      productId: product.id,
      code: product.code,
      name: product.name,
      kind: "GREEN_BEAN",
      required,
      committed: 0,
      onHand: product.onHand,
      onOrder,
      safetyStock: product.safetyStock,
      shortage,
      suggestedRoastInputKg: 0,
      sourceGreenBeanId: null,
      yieldRate: null,
    });
  }

  const supplies = input.supplies
    .map<SupplyPlan>((item) => {
      const required = supplyRequired.get(item.id) ?? 0;
      const onOrder = incomingSupplies.get(item.id) ?? 0;
      const forecastDuringLeadTime = item.averageDailyDemand * item.leadTimeDays;
      const shortage = Math.max(
        0,
        Math.max(required, forecastDuringLeadTime) + item.safetyStock - item.onHand - onOrder,
      );
      return {
        supplyItemId: item.id,
        code: item.code,
        name: item.name,
        baseUnit: item.baseUnit,
        required,
        onHand: item.onHand,
        onOrder,
        safetyStock: item.safetyStock,
        forecastDuringLeadTime,
        shortage,
      };
    })
    .filter((plan) => plan.required > 0 || plan.shortage > 0)
    .sort((a, b) => b.shortage - a.shortage || a.name.localeCompare(b.name));

  const production = finishedGoods.filter((plan) => plan.suggestedProduction > 0 && plan.hasRecipe);
  const roast = materials.filter((plan) => plan.kind === "ROASTED_BEAN" && plan.suggestedRoastInputKg > 0);
  const purchaseSkuCount =
    supplies.filter((plan) => plan.shortage > 0).length
    + materials.filter((plan) => plan.kind === "GREEN_BEAN" && plan.shortage > 0).length
    + materials.filter((plan) => plan.kind === "ROASTED_BEAN" && plan.shortage > 0 && !plan.yieldRate).length;

  return {
    finishedGoods,
    materials: materials.sort((a, b) => b.shortage - a.shortage || a.name.localeCompare(b.name)),
    supplies,
    summary: {
      productionSkuCount: production.length,
      productionUnits: production.reduce((sum, plan) => sum + plan.suggestedProduction, 0),
      roastSkuCount: roast.length,
      roastOutputKg: roast.reduce((sum, plan) => sum + plan.shortage, 0),
      purchaseSkuCount,
    },
  };
}
