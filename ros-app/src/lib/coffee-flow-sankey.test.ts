import { describe, expect, it } from "vitest";
import {
  SANKEY_NODE,
  toCoffeeFlowSankey,
  toCoffeeFlowSankeyMini,
} from "./coffee-flow-sankey";

const report = {
  greenBeans: [
    { boughtKg: 100, roastedKg: 60, adjustmentOutKg: 2, currentStockKg: 38 },
    { boughtKg: 50, roastedKg: 40, adjustmentOutKg: 0, currentStockKg: 10 },
  ],
  roastedBeans: [
    {
      producedKg: 90,
      roastLossKg: 10,
      packagedKg: 70,
      sampleOutKg: 3,
      adjustmentOutKg: 2,
      currentStockKg: 15,
    },
  ],
};

describe("toCoffeeFlowSankey", () => {
  it("builds kg-domain links from the coffee flow report", () => {
    const graph = toCoffeeFlowSankey(report);

    expect(graph.nodes).toHaveLength(7);
    const link = (source: number, target: number) =>
      graph.links.find((l) => l.source === source && l.target === target)?.value;

    expect(link(SANKEY_NODE.BELI_GB, SANKEY_NODE.ROASTING)).toBe(100);
    expect(link(SANKEY_NODE.BELI_GB, SANKEY_NODE.STOK_GB)).toBe(48);
    expect(link(SANKEY_NODE.ROASTING, SANKEY_NODE.PACKING)).toBe(70);
    expect(link(SANKEY_NODE.ROASTING, SANKEY_NODE.STOK_RB)).toBe(15);
    expect(link(SANKEY_NODE.ROASTING, SANKEY_NODE.SUSUT)).toBe(10);
    expect(link(SANKEY_NODE.ROASTING, SANKEY_NODE.PENYESUAIAN)).toBe(5); // sample 3 + opname 2
  });

  it("drops micro links below 0.5kg to keep the diagram legible", () => {
    const graph = toCoffeeFlowSankey({
      greenBeans: [
        { boughtKg: 100, roastedKg: 99.8, adjustmentOutKg: 0.1, currentStockKg: 0.1 },
      ],
      roastedBeans: [],
    });
    // Opname 0.1 kg tidak jadi pita.
    expect(
      graph.links.find((l) => l.target === SANKEY_NODE.PENYESUAIAN && l.source === SANKEY_NODE.BELI_GB),
    ).toBeUndefined();
  });

  it("conserves mass at the roasting node (input ≈ outputs)", () => {
    const graph = toCoffeeFlowSankey(report);
    const input = graph.links
      .filter((l) => l.target === SANKEY_NODE.ROASTING)
      .reduce((s, l) => s + l.value, 0);
    const output = graph.links
      .filter((l) => l.source === SANKEY_NODE.ROASTING)
      .reduce((s, l) => s + l.value, 0);
    expect(Math.abs(input - output)).toBeLessThan(0.5);
  });
});

describe("toCoffeeFlowSankeyMini", () => {
  it("collapses to Beli → Roasting → {Susut, Siap}", () => {
    const mini = toCoffeeFlowSankeyMini(report);
    expect(mini.nodes).toHaveLength(4);
    expect(mini.links.find((l) => l.source === 0)?.value).toBe(100);
    expect(mini.links.find((l) => l.target === 2)?.value).toBe(10);
    // Siap = input roasting − susut
    expect(mini.links.find((l) => l.target === 3)?.value).toBe(90);
  });
});
