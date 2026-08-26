"use client";

import { Sankey, Tooltip, ResponsiveContainer, Rectangle } from "recharts";
import type { CoffeeFlowSankeyGraph } from "@/lib/coffee-flow-sankey";
import { SANKEY_NODE } from "@/lib/coffee-flow-sankey";

/** Warna node per peran — memakai token tema, ikut light/dark otomatis. */
const NODE_FILL: Record<number, string> = {
  [SANKEY_NODE.BELI_GB]: "var(--stage-inventory)",
  [SANKEY_NODE.STOK_GB]: "var(--stage-warehouse)",
  [SANKEY_NODE.ROASTING]: "var(--stage-roasting)",
  [SANKEY_NODE.SUSUT]: "var(--status-danger)",
  [SANKEY_NODE.PENYESUAIAN]: "var(--status-warning)",
  [SANKEY_NODE.STOK_RB]: "#8C5A2B",
  [SANKEY_NODE.PACKING]: "var(--moss, #4B6B3C)",
};

type SankeyNodeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: { name?: string; value?: number };
};

function SankeyNode({ x = 0, y = 0, width = 0, height = 0, index = 0, payload }: SankeyNodeProps) {
  const isSourceSide = index <= SANKEY_NODE.ROASTING;
  const labelX = isSourceSide ? x + width + 6 : x - 6;
  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={NODE_FILL[index] ?? "var(--stage-neutral)"}
        radius={3}
      />
      <text
        x={labelX}
        y={y + height / 2}
        dy={4}
        textAnchor={isSourceSide ? "start" : "end"}
        className="fill-[var(--ink-secondary)] font-mono text-[10px]"
      >
        {payload?.name}
      </text>
    </g>
  );
}

type TooltipPayload = { payload?: { value?: number; source?: { name?: string }; target?: { name?: string } } };

function FlowTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;
  return (
    <div className="rounded-card border border-border bg-card px-3 py-2 text-xs shadow-elevation-card">
      <p className="font-semibold text-ink">
        {entry.source?.name} → {entry.target?.name}
      </p>
      <p className="tabular-nums text-ink-secondary">
        {Number(entry.value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })} kg
      </p>
    </div>
  );
}

export function CoffeeFlowSankeyChart({
  graph,
  height = 340,
}: {
  graph: CoffeeFlowSankeyGraph;
  height?: number;
}) {
  if (graph.links.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-tertiary">
        Belum ada arus kopi pada periode ini.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height }} role="img" aria-label="Diagram alur kopi dari pembelian green bean hingga packing">
      <ResponsiveContainer>
        <Sankey
          data={graph}
          nodePadding={22}
          nodeWidth={12}
          margin={{ top: 8, right: 150, bottom: 8, left: 8 }}
          link={{ stroke: "var(--ink-tertiary)", strokeOpacity: 0.28 }}
          node={<SankeyNode />}
        >
          <Tooltip content={<FlowTooltip />} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
