import { describe, it, expect } from "vitest";
import {
  buildRoasteryInsights,
  summarizeInsights,
  draftReorderFromProduct,
  SPECIALTY_THRESHOLD,
  type CopilotFacts,
} from "./roastery-intelligence";

describe("buildRoasteryInsights", () => {
  it("flags a HOLD lot as critical with a link to the lot page", () => {
    const facts: CopilotFacts = {
      lots: [{ id: "l1", code: "GB-001", qcStatus: "HOLD", defectCount: null, moisturePct: 11 }],
      cupping: [],
      reorder: [],
    };
    const insights = buildRoasteryInsights(facts);
    const hold = insights.find((i) => i.id === "lot:hold:l1");
    expect(hold?.severity).toBe("critical");
    expect(hold?.action?.href).toBe("/inventory/lots/l1");
  });

  it("flags high defect count via assessDefectRisk", () => {
    const facts: CopilotFacts = {
      lots: [{ id: "l2", code: "GB-002", qcStatus: "RELEASED", defectCount: 12, moisturePct: 11 }],
      cupping: [],
      reorder: [],
    };
    const insights = buildRoasteryInsights(facts);
    expect(insights.some((i) => i.id === "lot:defect:l2" && i.severity === "attention")).toBe(true);
  });

  it("flags predicted low yield when moisture is high", () => {
    const facts: CopilotFacts = {
      lots: [{ id: "l3", code: "GB-003", qcStatus: "RELEASED", defectCount: 0, moisturePct: 16 }],
      cupping: [],
      reorder: [],
    };
    const insights = buildRoasteryInsights(facts);
    const yieldInsight = insights.find((i) => i.id === "lot:yield:l3");
    expect(yieldInsight).toBeDefined();
    expect(yieldInsight?.metric).toMatch(/%$/);
  });

  it("flags cupping below the specialty threshold", () => {
    const facts: CopilotFacts = {
      lots: [],
      cupping: [{ id: "c1", code: "CUP-001", totalScore: 78.5, defectCount: 0, lotId: "l1" }],
      reorder: [],
    };
    const insights = buildRoasteryInsights(facts);
    const below = insights.find((i) => i.id === "cupping:below:c1");
    expect(below?.severity).toBe("attention");
    expect(below?.metric).toBe(`SCA 78.5`);
  });

  it("does not flag a specialty cupping score", () => {
    const facts: CopilotFacts = {
      lots: [],
      cupping: [{ id: "c2", code: "CUP-002", totalScore: 85, defectCount: 0, lotId: "l1" }],
      reorder: [],
    };
    expect(buildRoasteryInsights(facts).some((i) => i.id === "cupping:below:c2")).toBe(false);
  });

  it("suggests restock when stock is below safety stock", () => {
    const facts: CopilotFacts = {
      lots: [],
      cupping: [],
      reorder: [{ subjectKind: "PRODUCT", subjectId: "p1", name: "Ethiopia", suggestedQuantity: 20, unitLabel: "kg" }],
    };
    const insights = buildRoasteryInsights(facts);
    const reorder = insights.find((i) => i.id === "reorder:p1");
    expect(reorder?.action?.href).toBe("/inventory");
    expect(reorder?.metric).toBe("20 kg");
  });

  it("orders critical before attention before info", () => {
    const facts: CopilotFacts = {
      lots: [
        { id: "l1", code: "GB-001", qcStatus: "RELEASED", defectCount: 0, moisturePct: 11 },
        { id: "l2", code: "GB-002", qcStatus: "HOLD", defectCount: 0, moisturePct: 11 },
      ],
      cupping: [],
      reorder: [],
    };
    const insights = buildRoasteryInsights(facts);
    expect(insights[0].severity).toBe("critical");
  });
});

describe("summarizeInsights", () => {
  it("returns an all-clear message when there are no insights", () => {
    expect(summarizeInsights([])).toMatch(/tidak ada sinyal/i);
  });

  it("summarizes counts and bullets", () => {
    const text = summarizeInsights(
      buildRoasteryInsights({
        lots: [{ id: "l2", code: "GB-002", qcStatus: "HOLD", defectCount: 0, moisturePct: 11 }],
        cupping: [{ id: "c1", code: "CUP-001", totalScore: 77, defectCount: 0, lotId: null }],
        reorder: [],
      }),
    );
    expect(text).toMatch(/1 kritis/);
    expect(text).toMatch(/1 perhatian/);
  });
});

describe("draftReorderFromProduct", () => {
  it("returns null when stock already covers safety stock", () => {
    expect(
      draftReorderFromProduct({ id: "p", name: "X", stockKg: 50, safetyStockQuantity: 40 }),
    ).toBeNull();
  });

  it("drafts a top-up to safety stock", () => {
    const draft = draftReorderFromProduct({ id: "p", name: "Ethiopia", stockKg: 10, safetyStockQuantity: 30 });
    expect(draft?.suggestedQuantity).toBe(20);
    expect(draft?.unitLabel).toBe("kg");
  });
});

describe("SPECIALTY_THRESHOLD", () => {
  it("is 80 per SCA convention", () => {
    expect(SPECIALTY_THRESHOLD).toBe(80);
  });
});
