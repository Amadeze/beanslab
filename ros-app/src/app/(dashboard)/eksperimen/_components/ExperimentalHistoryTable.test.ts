import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExperimentalHistoryTable } from "./ExperimentalHistoryTable";
import type { ExperimentalProductionRow } from "../actions";

function batch(overrides: Partial<ExperimentalProductionRow>): ExperimentalProductionRow {
  return {
    id: "experiment-1",
    code: "EXP-001",
    name: "Eksperimen Test",
    outputProductName: "Prototype Test",
    inputKg: 1,
    outputKg: 0.9,
    lossKg: 0.1,
    hppPerUnit: 60_000,
    status: "COMPLETED",
    createdAt: "2026-08-14T00:00:00.000Z",
    notes: null,
    componentCount: 1,
    parentRoastBatchId: null,
    parentRoastBatchCode: null,
    ...overrides,
  };
}

describe("ExperimentalHistoryTable", () => {
  it("offers Void only for completed batches", () => {
    const html = renderToStaticMarkup(createElement(ExperimentalHistoryTable, {
      batches: [
        batch({ id: "completed", code: "EXP-COMPLETE" }),
        batch({ id: "void", code: "EXP-VOID", status: "VOID" }),
      ],
    }));

    expect(html.match(/>Void<\/button>/g)).toHaveLength(1);
  });

  it("links a traced experiment back to its source roast", () => {
    const html = renderToStaticMarkup(createElement(ExperimentalHistoryTable, {
      batches: [batch({
        parentRoastBatchId: "roast-1",
        parentRoastBatchCode: "RST-001",
      })],
    }));

    expect(html).toContain('href="/roasting/batch/roast-1"');
    expect(html).toContain("RST-001");
  });
});
