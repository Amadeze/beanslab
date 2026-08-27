"use client";

import { Sankey, Tooltip, ResponsiveContainer, Rectangle } from "recharts";
import { toCoffeeFlowSankeyMini } from "@/lib/coffee-flow-sankey";

const NODE_FILL: Record<number, string> = {
  0: "var(--stage-inventory)",   // Beli GB
  1: "var(--stage-roasting)",    // Roasting
  2: "var(--status-danger)",     // Susut
  3: "var(--status-success)",    // RB Siap
};

type MiniNodeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: { name?: string };
};

function MiniNode({ x = 0, y = 0, width = 0, height = 0, index = 0, payload }: MiniNodeProps) {
  const labelRight = index >= 2;
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
        x={labelRight ? x + width + 5 : x - 5}
        y={y + height / 2}
        dy={3.5}
        textAnchor={labelRight ? "start" : "end"}
        className="fill-[var(--ink-secondary)] font-mono text-[9px]"
      >
        {payload?.name}
      </text>
    </g>
  );
}

function MiniTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { value?: number; source?: { name?: string }; target?: { name?: string } } }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;
  return (
    <div className="rounded-card border border-border bg-card px-2.5 py-1.5 text-xs shadow-elevation-card">
      <span className="tabular-nums text-ink">
        {Number(entry.value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })} kg ·{" "}
      </span>
      <span className="text-ink-secondary">
        {entry.source?.name} → {entry.target?.name}
      </span>
    </div>
  );
}

/** Mini Sankey arus kopi 30 hari untuk kartu Hari Ini (kg). */
export function CoffeeFlowMini({
  beliKg,
  diRoastKg,
  susutKg,
}: {
  beliKg: number;
  diRoastKg: number;
  susutKg: number;
}) {
  const graph = toCoffeeFlowSankeyMini({
    greenBeans: [{ boughtKg: beliKg, roastedKg: diRoastKg, adjustmentOutKg: 0, currentStockKg: 0 }],
    roastedBeans: [
      {
        producedKg: Math.max(0, diRoastKg - susutKg),
        roastLossKg: susutKg,
        packagedKg: Math.max(0, diRoastKg - susutKg),
        sampleOutKg: 0,
        adjustmentOutKg: 0,
        currentStockKg: 0,
      },
    ],
  });

  return (
    <section
      className="overflow-hidden rounded-[14px] border border-border bg-card"
      aria-labelledby="coffee-flow-mini-title"
    >
      <div className="flex min-h-12 items-center justify-between border-b border-border/70 px-4 md:px-5">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-copper">30 hari terakhir</p>
          <h2 id="coffee-flow-mini-title" className="text-sm font-bold text-foreground">
            Arus kopi
          </h2>
        </div>
        <p className="text-right text-xs leading-4 text-ink-secondary tabular-nums">
          Masuk roasting{" "}
          <strong className="text-foreground">{diRoastKg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kg</strong>
          {" · "}susut{" "}
          <strong className="text-[var(--status-danger)]">
            {diRoastKg > 0 ? `${((susutKg / diRoastKg) * 100).toFixed(1)}%` : "—"}
          </strong>
        </p>
      </div>
      <div className="h-[150px] px-2 py-1">
        {diRoastKg <= 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-tertiary">
            Belum ada roasting pada 30 hari terakhir.
          </div>
        ) : (
          <ResponsiveContainer>
            <Sankey
              data={graph}
              nodePadding={14}
              nodeWidth={9}
              margin={{ top: 6, right: 90, bottom: 6, left: 70 }}
              link={{ stroke: "var(--ink-tertiary)", strokeOpacity: 0.3 }}
              node={<MiniNode />}
            >
              <Tooltip content={<MiniTooltip />} />
            </Sankey>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
