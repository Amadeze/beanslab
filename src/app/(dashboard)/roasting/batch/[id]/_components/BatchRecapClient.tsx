"use client";

import { useState } from "react";
import {
  Flame, Clock, Thermometer, ArrowDown, ChevronDown, ChevronUp,
  Package, Scale, TrendingDown, CheckCircle, AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

type RoastData = {
  id: string;
  title: string | null;
  roastDate: string | null;
  duration: number | null;
  chargeTemperature: number | null;
  dropTemperature: number | null;
  firstCrackStartTime: number | null;
  firstCrackEndTime: number | null;
  greenWeightGrams: number | null;
  roastedWeightGrams: number | null;
  lossPercent: number | null;
  beanTemperatureSeries: Array<{ second: number; value: number }> | null;
  environmentalTemperatureSeries: Array<{ second: number; value: number }> | null;
  events: Array<{ second: number; type: string; value?: string | number; label?: string }> | null;
  metadata: Record<string, unknown> | null;
};

type ChildBatch = {
  id: string;
  index: number;
  roastId: string | null;
  roastDuration: number | null;
  dropTemp: number | null;
  recordedAt: string;
  roast: RoastData | null;
};

type RecapData = {
  id: string;
  code: string;
  status: string;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  inputProduct: { id: string; name: string };
  outputProduct: { id: string; name: string };
  machine: { id: string; name: string; capacityKg: number | null } | null;
  createdBy: { id: string; name: string };
  targetWeightKg: number;
  actualOutputKg: number | null;
  totalLossPercent: number | null;
  childCount: number;
  completedCount: number;
  pendingCount: number;
  children: ChildBatch[];
  summary: {
    totalGreenGrams: number;
    totalRoastedGrams: number;
    avgDuration: number | null;
    roastCount: number;
  };
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function BatchRecapClient({ data }: { data: RecapData }) {
  const [expandedChild, setExpandedChild] = useState<number | null>(null);

  const lossColor = data.totalLossPercent != null
    ? data.totalLossPercent < 18 ? "text-emerald-600"
    : data.totalLossPercent <= 25 ? "text-amber-600"
    : "text-red-600"
    : "text-[var(--text-tertiary)]";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Package size={16} />}
          label="Input"
          value={`${data.targetWeightKg} kg`}
          sub={data.inputProduct.name}
        />
        <SummaryCard
          icon={<Scale size={16} />}
          label="Output"
          value={data.actualOutputKg != null ? `${data.actualOutputKg} kg` : "-"}
          sub={data.outputProduct.name}
        />
        <SummaryCard
          icon={<TrendingDown size={16} />}
          label="Susut"
          value={data.totalLossPercent != null ? `${data.totalLossPercent}%` : "-"}
          valueClass={lossColor}
        />
        <SummaryCard
          icon={<Flame size={16} />}
          label="Rata-rata Durasi"
          value={data.summary.avgDuration != null ? formatDuration(data.summary.avgDuration) : "-"}
          sub={`${data.summary.roastCount} roasting`}
        />
      </div>

      {/* Batch Info */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Info Batch</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <InfoField label="Kode" value={data.code} />
          <InfoField label="Status" value={data.status} />
          <InfoField label="Mesin" value={data.machine?.name ?? "-"} />
          <InfoField label="Kapasitas" value={data.machine?.capacityKg ? `${data.machine.capacityKg} kg` : "-"} />
          <InfoField label="Dibuat Oleh" value={data.createdBy.name} />
          <InfoField label="Tanggal" value={formatDate(data.createdAt)} />
          <InfoField label="Selesai" value={formatDate(data.completedAt)} />
          <InfoField label="Total Batch" value={`${data.completedCount}/${data.childCount} selesai`} />
        </div>
        {data.notes && (
          <div className="mt-3 text-xs text-[var(--text-secondary)]">
            <span className="font-medium">Catatan:</span> {data.notes}
          </div>
        )}
      </div>

      {/* Child Batches */}
      <div>
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">
          Detail Roasting ({data.children.length} batch)
        </h3>
        <div className="space-y-2">
          {data.children.map((child) => {
            const isExpanded = expandedChild === child.index;
            const r = child.roast;

            return (
              <div key={child.id} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedChild(isExpanded ? null : child.index)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--glass-bg-hover)] transition"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    r ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-500/10 text-gray-400"
                  }`}>
                    {child.index}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {r?.title || `Batch ${child.index}`}
                      </span>
                      {r && (
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {r.duration ? formatDuration(r.duration) : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      {r ? (
                        <>
                          {r.greenWeightGrams}g → {r.roastedWeightGrams}g
                          {r.lossPercent != null && (
                            <span className={r.lossPercent < 18 ? "text-emerald-600" : r.lossPercent <= 25 ? "text-amber-600" : "text-red-600"}>
                              {" "}({r.lossPercent}%)
                            </span>
                          )}
                        </>
                      ) : (
                        "Belum ada data roast"
                      )}
                    </div>
                  </div>
                  {r && (
                    <div className="shrink-0 text-[var(--text-tertiary)]">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  )}
                </button>

                {isExpanded && r && (
                  <div className="border-t border-[var(--glass-border)] p-4 space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <MiniStat label="Charge" value={r.chargeTemperature ? `${r.chargeTemperature}°C` : "-"} />
                      <MiniStat label="Drop" value={r.dropTemperature ? `${r.dropTemperature}°C` : "-"} />
                      <MiniStat label="FCs" value={r.firstCrackStartTime ? formatDuration(r.firstCrackStartTime) : "-"} />
                      <MiniStat label="Duration" value={r.duration ? formatDuration(r.duration) : "-"} />
                    </div>

                    {/* Temperature Chart */}
                    {r.beanTemperatureSeries && r.beanTemperatureSeries.length > 0 && (
                      <TemperatureChart
                        btData={r.beanTemperatureSeries}
                        etData={r.environmentalTemperatureSeries}
                        events={r.events}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon, label, value, sub, valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-[var(--text-tertiary)] mb-2">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-bold ${valueClass || "text-[var(--text-primary)]"}`}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sub}</p>}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">{label}</p>
      <p className="text-sm text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--glass-border)] p-2">
      <p className="text-[10px] text-[var(--text-tertiary)]">{label}</p>
      <p className="text-sm font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function TemperatureChart({
  btData, etData, events,
}: {
  btData: Array<{ second: number; value: number }>;
  etData: Array<{ second: number; value: number }> | null;
  events: Array<{ second: number; type: string }> | null;
}) {
  const chartData = btData.map((bt) => {
    const et = etData?.find((e) => e.second === bt.second);
    return {
      time: bt.second,
      BT: bt.value,
      ET: et?.value ?? null,
    };
  });

  const eventMarkers = events?.filter((e) =>
    ["CHARGE", "FCs", "FCe", "SCs", "DROP"].includes(e.type),
  ) ?? [];

  const eventColors: Record<string, string> = {
    CHARGE: "#3b82f6",
    FCs: "#4C0302",
    FCe: "#4C0302",
    SCs: "#ef4444",
    DROP: "#00C8DF",
  };

  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          <XAxis
            dataKey="time"
            tickFormatter={(v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`}
            stroke="var(--text-tertiary)"
            fontSize={10}
            tickLine={false}
          />
          <YAxis stroke="var(--text-tertiary)" fontSize={10} tickLine={false} domain={["dataMin - 10", "dataMax + 10"]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--glass-bg-hover)",
              border: "1px solid var(--glass-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value, name) => [`${value}°C`, String(name)]}
            labelFormatter={(label) => {
              const min = Math.floor(Number(label) / 60);
              const sec = Number(label) % 60;
              return `${min}:${String(sec).padStart(2, "0")}`;
            }}
          />
          {eventMarkers.map((e) => (
            <ReferenceLine
              key={`${e.type}-${e.second}`}
              x={e.second}
              stroke={eventColors[e.type] || "#999"}
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
          ))}
          <Line type="monotone" dataKey="BT" stroke="#00668E" strokeWidth={2} dot={false} />
          {etData && etData.length > 0 && (
            <Line type="monotone" dataKey="ET" stroke="#60a5fa" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
