/**
 * Transform Laporan Arus Kopi → graf Sankey (domain kg).
 *
 * Prinsip kejujuran visual: SEMUA link memakai satuan yang sama (kg) agar
 * lebar pita proporsional secara jujur. Alur unit (produk jadi terjual)
 * tetap di kartu pipeline & tabel — tidak dicampur ke diagram ini.
 *
 * Struktur node:
 *   Beli GB ─▶ Roasting ─▶ Susut
 *                 │
 *                 ├─▶ Packing / Keluar
 * Stok GB ────────┘└─▶ Stok RB
 * Penyesuaian & Sample (GB/RB masuk node terpisah)
 */

export type SankeyGraphNode = { name: string };
export type SankeyGraphLink = { source: number; target: number; value: number };
export type CoffeeFlowSankeyGraph = {
  nodes: SankeyGraphNode[];
  links: SankeyGraphLink[];
};

type GreenBeanRow = {
  boughtKg: number;
  roastedKg: number;
  adjustmentOutKg: number;
  currentStockKg: number;
};

type RoastedBeanRow = {
  producedKg: number;
  roastLossKg: number;
  packagedKg: number;
  sampleOutKg: number;
  adjustmentOutKg: number;
  currentStockKg: number;
};

export type CoffeeFlowReportForSankey = {
  greenBeans: GreenBeanRow[];
  roastedBeans: RoastedBeanRow[];
};

/** Indeks node stabil — dipakai komponen untuk memberi warna per peran. */
export const SANKEY_NODE = {
  BELI_GB: 0,
  STOK_GB: 1,
  ROASTING: 2,
  SUSUT: 3,
  PENYESUAIAN: 4,
  STOK_RB: 5,
  PACKING: 6,
} as const;

const sum = (rows: Array<Record<string, number>>, key: string) =>
  rows.reduce((total, row) => total + Math.max(0, Number(row[key] ?? 0)), 0);

function addLink(links: SankeyGraphLink[], source: number, target: number, value: number) {
  // Abaikan pita mikro (< 0.5 kg) agar diagram tetap legible.
  if (!Number.isFinite(value) || value < 0.5) return;
  const existing = links.find((l) => l.source === source && l.target === target);
  if (existing) {
    existing.value = Math.round((existing.value + value) * 100) / 100;
    return;
  }
  links.push({ source, target, value: Math.round(value * 100) / 100 });
}

export function toCoffeeFlowSankey(
  report: CoffeeFlowReportForSankey,
): CoffeeFlowSankeyGraph {
  const gb = report.greenBeans ?? [];
  const rb = report.roastedBeans ?? [];

  const beliGb = sum(gb, "boughtKg");
  const diRoast = sum(gb, "roastedKg");
  const stokGb = sum(gb, "currentStockKg");
  const opnameGb = sum(gb, "adjustmentOutKg");

  const susut = sum(rb, "roastLossKg");
  const packing = sum(rb, "packagedKg");
  const stokRb = sum(rb, "currentStockKg");
  const sampleRb = sum(rb, "sampleOutKg");
  const opnameRb = sum(rb, "adjustmentOutKg");

  const nodes: SankeyGraphNode[] = [
    { name: "Beli Green Bean" },
    { name: "Stok Green Bean" },
    { name: "Roasting" },
    { name: "Susut" },
    { name: "Sample & Opname" },
    { name: "Stok Roasted Bean" },
    { name: "Packing / Keluar" },
  ];

  const links: SankeyGraphLink[] = [];
  addLink(links, SANKEY_NODE.BELI_GB, SANKEY_NODE.ROASTING, diRoast);
  addLink(links, SANKEY_NODE.BELI_GB, SANKEY_NODE.STOK_GB, stokGb);
  addLink(links, SANKEY_NODE.BELI_GB, SANKEY_NODE.PENYESUAIAN, opnameGb);
  addLink(links, SANKEY_NODE.ROASTING, SANKEY_NODE.PACKING, packing);
  addLink(links, SANKEY_NODE.ROASTING, SANKEY_NODE.STOK_RB, stokRb);
  addLink(links, SANKEY_NODE.ROASTING, SANKEY_NODE.SUSUT, susut);
  addLink(links, SANKEY_NODE.ROASTING, SANKEY_NODE.PENYESUAIAN, sampleRb);
  addLink(links, SANKEY_NODE.ROASTING, SANKEY_NODE.PENYESUAIAN, opnameRb);

  return { nodes, links };
}

/**
 * Varian mini untuk Hari Ini: hanya Beli → Roasting → {Susut, Siap}.
 * Node index mengikuti SANKEY_NODE agar warna konsisten.
 */
export function toCoffeeFlowSankeyMini(
  report: CoffeeFlowReportForSankey,
): CoffeeFlowSankeyGraph {
  const full = toCoffeeFlowSankey(report);
  const rbSiap =
    full.links
      .filter((l) => l.target === SANKEY_NODE.PACKING || l.target === SANKEY_NODE.STOK_RB)
      .reduce((s, l) => s + l.value, 0);

  const nodes = [
    full.nodes[SANKEY_NODE.BELI_GB],
    full.nodes[SANKEY_NODE.ROASTING],
    full.nodes[SANKEY_NODE.SUSUT],
    { name: "RB Siap" },
  ];
  const roastingIn = full.links.find(
    (l) => l.source === SANKEY_NODE.BELI_GB && l.target === SANKEY_NODE.ROASTING,
  )?.value ?? 0;

  const links: SankeyGraphLink[] = [];
  if (roastingIn > 0) links.push({ source: 0, target: 1, value: roastingIn });
  const susut = full.links.find((l) => l.target === SANKEY_NODE.SUSUT)?.value ?? 0;
  if (susut > 0) links.push({ source: 1, target: 2, value: susut });
  const sisa = Math.max(0, Math.round((roastingIn - susut) * 100) / 100);
  if (sisa > 0) links.push({ source: 1, target: 3, value: sisa });

  void rbSiap;
  return { nodes, links };
}
