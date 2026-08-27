import { describe, expect, it } from "vitest";
import { buildDemandPlan, type DemandPlanningInput } from "./operations-planning";

function fixture(): DemandPlanningInput {
  return {
    products: [
      { id: "fg", code: "FG-250", name: "Kopi 250g", kind: "FINISHED_GOODS", onHand: 10, safetyStock: 5, leadTimeDays: 7, averageDailyDemand: 1 },
      { id: "rb", code: "RB-M", name: "Roasted Medium", kind: "ROASTED_BEAN", onHand: 1, safetyStock: 0.5, leadTimeDays: 2, averageDailyDemand: 0, materialOrigin: "INTERNAL_ROAST", sourceGreenBeanId: "gb" },
      { id: "gb", code: "GB-A", name: "Green A", kind: "GREEN_BEAN", onHand: 3, safetyStock: 1, leadTimeDays: 14, averageDailyDemand: 0 },
    ],
    supplies: [
      { id: "pouch", code: "PKG-250", name: "Pouch 250g", baseUnit: "PCS", onHand: 3, safetyStock: 2, leadTimeDays: 7, averageDailyDemand: 0 },
    ],
    recipes: [{
      productId: "fg",
      outputGrams: 250,
      coffeeItems: [{ productId: "rb", quantityPerUnitKg: 0.25 }],
      supplyItems: [{ supplyItemId: "pouch", quantityPerUnit: 1 }],
    }],
    openDemand: [{ productId: "fg", quantity: 20 }],
    commitments: [{ productId: "fg", quantity: 8 }],
    incomingProducts: [],
    incomingSupplies: [],
    yieldByRoastedProduct: [{ productId: "rb", yieldRate: 0.8 }],
  };
}

describe("buildDemandPlan", () => {
  it("uses inventory position and does not double-count confirmed demand", () => {
    const plan = buildDemandPlan(fixture());
    expect(plan.finishedGoods[0]).toMatchObject({
      openDemand: 20,
      committed: 8,
      uncommittedDemand: 12,
      inventoryPosition: 2,
      suggestedProduction: 15,
    });
  });

  it("explodes production through recipe, yield, and supply requirements", () => {
    const plan = buildDemandPlan(fixture());
    expect(plan.materials.find((row) => row.productId === "rb")).toMatchObject({
      required: 3.75,
      shortage: 3.25,
      suggestedRoastInputKg: 4.0625,
    });
    expect(plan.supplies[0]).toMatchObject({ required: 15, shortage: 14 });
    expect(plan.materials.find((row) => row.productId === "gb")).toMatchObject({
      required: 4.0625,
      shortage: 2.0625,
    });
  });

  it("subtracts open purchase orders before recommending work", () => {
    const input = fixture();
    input.incomingProducts = [{ productId: "fg", quantity: 20 }, { productId: "gb", quantity: 10 }];
    input.incomingSupplies = [{ supplyItemId: "pouch", quantity: 20 }];
    const plan = buildDemandPlan(input);
    expect(plan.finishedGoods[0].suggestedProduction).toBe(0);
    expect(plan.supplies).toHaveLength(0);
  });

  it("uses a conservative yield fallback when roast history is absent", () => {
    const input = fixture();
    input.yieldByRoastedProduct = [];
    const plan = buildDemandPlan(input);
    const roast = plan.materials.find((row) => row.productId === "rb");
    expect(roast?.yieldRate).toBe(0.82);
    expect(roast?.suggestedRoastInputKg).toBeCloseTo(3.25 / 0.82);
  });

  it("keeps products without a recipe visible but never invents material usage", () => {
    const input = fixture();
    input.recipes = [];
    const plan = buildDemandPlan(input);
    expect(plan.finishedGoods[0]).toMatchObject({ hasRecipe: false, suggestedProduction: 15 });
    expect(plan.materials).toHaveLength(0);
    expect(plan.summary.productionSkuCount).toBe(0);
  });
});
