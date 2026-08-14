import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GrindingHistoryTable } from "./GrindingHistoryTable";
import type { GrindingBatchRow } from "../actions";

function batch(overrides: Partial<GrindingBatchRow>): GrindingBatchRow {
  return {
    id: "grinding-1",
    code: "GRD-001",
    sourceProductName: "Roasted Bean Test",
    outputProductName: "Ground Coffee Test",
    grindSize: "MEDIUM",
    customGrindLabel: null,
    grinderName: null,
    operatorName: "Operator",
    inputKg: 5,
    outputKg: 4.5,
    lossKg: 0.5,
    grindingCost: 0,
    status: "COMPLETED",
    createdAt: "2026-08-14T00:00:00.000Z",
    notes: null,
    batchReference: null,
    parentRoastBatchId: null,
    parentRoastBatchCode: null,
    ...overrides,
  };
}

describe("GrindingHistoryTable", () => {
  it("offers Void only for completed batches", () => {
    const html = renderToStaticMarkup(createElement(GrindingHistoryTable, {
      batches: [
        batch({ id: "completed", code: "GRD-COMPLETE" }),
        batch({ id: "void", code: "GRD-VOID", status: "VOID" }),
      ],
    }));

    expect(html.match(/>Void<\/button>/g)).toHaveLength(1);
  });

  it("links a traced grinding batch back to its source roast", () => {
    const html = renderToStaticMarkup(createElement(GrindingHistoryTable, {
      batches: [batch({
        parentRoastBatchId: "roast-1",
        parentRoastBatchCode: "RST-001",
      })],
    }));

    expect(html).toContain('href="/roasting/batch/roast-1"');
    expect(html).toContain("RST-001");
  });
});
