"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

type ChartType = "area" | "bar" | "line" | "pie";

interface ReportChartProps {
  title: string;
  type: ChartType;
  data: Record<string, any>[];
  xKey?: string;
  yKey?: string;
  yKeys?: string[];
  yFormatter?: (value: number) => string;
  height?: number;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
}

const DEFAULT_COLORS = [
  "#00C8DF",
  "#B65331",
  "#A66F12",
  "#6F4A6A",
  "#4B6B3C",
  "#2B7567",
];

const TOOLTIP_STYLE = {
  backgroundColor: "#fff",
  border: "1px solid #E7E5E4",
  borderRadius: "8px",
  fontSize: "12px",
};

// Default compact number formatter (Rupiah) — hindari singkatan yang salah
// satuan (mis. miliar ditulis "M"). Dipakai hanya untuk label sumbu Y.
const formatCompact = (value: number): string => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} Miliar`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}Jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}rb`;
  return value.toString();
};

export function ReportChart({
  title,
  type,
  data,
  xKey = "date",
  yKey = "value",
  yKeys,
  yFormatter,
  height = 300,
  colors = DEFAULT_COLORS,
  showGrid = true,
  showLegend = false,
  className,
}: ReportChartProps) {
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 8, right: 8, left: 0, bottom: 0 },
    };

    const axisProps = {
      tick: { fontSize: 10, fill: "#78716C" },
      tickLine: false,
      axisLine: false,
    };

    const yAxisProps = {
      ...axisProps,
      tickFormatter: yFormatter || formatCompact,
    };

    switch (type) {
      case "area":
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />}
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {showLegend && <Legend />}
            {(yKeys || [yKey]).map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        );

      case "bar":
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />}
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {showLegend && <Legend />}
            {(yKeys || [yKey]).map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case "line":
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />}
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {showLegend && <Legend />}
            {(yKeys || [yKey]).map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            ))}
          </LineChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              // Jari-jari relatif terhadap tinggi wadah agar proporsional
              // (bukan nilai absolut yang meledak di ukuran kecil).
              innerRadius="38%"
              outerRadius="68%"
              paddingAngle={2}
              dataKey={yKey}
              nameKey={xKey}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {showLegend && <Legend />}
          </PieChart>
        );

      default:
        return null;
    }
  };

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className={cn("rounded-xl border border-stone-200 bg-white p-4", className)}>
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-500">
          {title}
        </p>
        <div style={{ height }} className="flex items-center justify-center text-stone-400 text-sm">
          Tidak ada data
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white p-4", className)}>
      <p className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-500">
        {title}
      </p>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
