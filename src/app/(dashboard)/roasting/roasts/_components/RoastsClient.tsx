"use client";

import { useMemo, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Flame,
  Clock,
  Thermometer,
  ArrowDown,
  ChevronDown,
  Upload,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { RoastProfileRow } from "../../actions";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function MiniChart({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 144;
  const height = 34;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-9 w-36 overflow-visible"
      aria-hidden
    >
      <path
        d={`M 0 ${height - 1} H ${width}`}
        stroke="currentColor"
        strokeOpacity=".08"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RoastsClient({ roasts }: { roasts: RoastProfileRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredRoasts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    if (!needle) return roasts;

    return roasts.filter((roast) => {
      const metadata = roast.metadata ?? {};
      return [
        roast.title,
        roast.machine.name,
        metadata.beans,
        metadata.profile,
        metadata.roaster,
      ].some((value) =>
        String(value ?? "")
          .toLocaleLowerCase("id-ID")
          .includes(needle),
      );
    });
  }, [query, roasts]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/roasting/manual-upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        if (data.duplicate) {
          setUploadResult("File sudah pernah diupload sebelumnya.");
        } else {
          setUploadResult(
            `Berhasil! ${data.parsed?.title || "Roast"} - ${data.parsed?.btPoints || 0} data points.`,
          );
          window.location.reload();
        }
      } else {
        setUploadResult(`Gagal: ${data.error}`);
      }
    } catch {
      setUploadResult("Gagal mengupload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)]">
      <div className="flex flex-col gap-3 border-b border-[var(--glass-border)] bg-[var(--surface)] px-4 py-3 sm:flex-row sm:items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".alog"
          onChange={handleUpload}
          className="hidden"
        />
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari profil, bean, mesin, atau roaster..."
            className="h-10 w-full rounded-[10px] border border-[var(--glass-border)] bg-[var(--glass-bg)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--domain-roasting)] focus:ring-2 focus:ring-[var(--domain-roasting)]/10"
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            {filteredRoasts.length} / {roasts.length} profil
          </span>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-[var(--domain-roasting)] px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Upload size={14} />
            {uploading ? "Mengimpor..." : "Impor .alog"}
          </button>
        </div>
      </div>

      {uploadResult && (
        <div
          className={`border-b border-[var(--glass-border)] px-4 py-2 text-xs ${uploadResult.startsWith("Berhasil") ? "text-emerald-700" : "text-red-600"}`}
        >
          {uploadResult}
        </div>
      )}

      {roasts.length === 0 ? (
        <div className="p-12 text-center">
          <Flame className="mx-auto mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
          <p className="text-[var(--text-secondary)]">
            Belum ada data roast. Impor file .alog untuk memulai.
          </p>
        </div>
      ) : filteredRoasts.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <Search className="mx-auto mb-3 size-6 text-[var(--text-tertiary)]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Profil tidak ditemukan
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Coba nama bean, mesin, atau roaster lain.
          </p>
        </div>
      ) : (
        <div>
          <div className="hidden grid-cols-[minmax(260px,1.5fr)_120px_90px_90px_150px_28px] items-center gap-4 border-b border-[var(--glass-border)] bg-black/[0.025] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)] lg:grid">
            <span>Profil roast</span>
            <span>Mesin</span>
            <span>Durasi</span>
            <span>Susut</span>
            <span>Kurva panas</span>
            <span />
          </div>
          {filteredRoasts.map((roast, index) => {
            const isExpanded = expandedId === roast.id;
            const tempData =
              roast.beanTemperatureSeries?.map((point) => point.value) ?? [];

            return (
              <motion.div
                key={roast.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.24,
                  delay: Math.min(index * 0.025, 0.18),
                }}
                className="border-b border-[var(--glass-border)] last:border-b-0"
              >
                {/* Summary Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : roast.id)}
                  aria-expanded={isExpanded}
                  className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors lg:grid-cols-[minmax(260px,1.5fr)_120px_90px_90px_150px_28px] lg:gap-4 ${
                    isExpanded
                      ? "bg-[var(--domain-roasting)]/[0.055]"
                      : "hover:bg-black/[0.025]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--domain-roasting)]/20 bg-[var(--domain-roasting)]/10">
                      <Flame className="h-4 w-4 text-[var(--domain-roasting)]" />
                      <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-[var(--surface)] bg-[var(--domain-roasting)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                        {roast.title || "Untitled Roast"}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                        <span>{formatDate(roast.roastDate)}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">
                          {String(
                            roast.metadata?.beans ??
                              roast.metadata?.profile ??
                              "Profil Artisan",
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="hidden truncate text-xs font-semibold text-[var(--text-secondary)] lg:block">
                    {roast.machine.name}
                  </span>
                  <span className="hidden items-center gap-1.5 text-xs tabular-nums text-[var(--text-secondary)] lg:flex">
                    <Clock size={12} /> {formatDuration(roast.duration)}
                  </span>
                  <span
                    className={`hidden items-center gap-1.5 text-xs font-bold tabular-nums lg:flex ${roast.lossPercent != null && roast.lossPercent > 18 ? "text-red-600" : "text-[var(--domain-roasting)]"}`}
                  >
                    <ArrowDown size={12} />{" "}
                    {roast.lossPercent != null
                      ? `${roast.lossPercent.toFixed(1)}%`
                      : "—"}
                  </span>
                  {tempData.length > 0 ? (
                    <div className="hidden text-[var(--domain-roasting)] lg:block">
                      <MiniChart data={tempData} color="currentColor" />
                    </div>
                  ) : (
                    <span className="hidden text-[10px] text-[var(--text-tertiary)] lg:block">
                      Tanpa kurva
                    </span>
                  )}
                  <div
                    className={`shrink-0 text-[var(--text-tertiary)] transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <ChevronDown size={17} />
                  </div>
                  <div className="col-span-2 flex items-center gap-4 pl-12 text-[11px] text-[var(--text-tertiary)] lg:hidden">
                    <span>{roast.machine.name}</span>
                    <span>{formatDuration(roast.duration)}</span>
                    {roast.lossPercent != null && (
                      <strong className="text-[var(--domain-roasting)]">
                        {roast.lossPercent.toFixed(1)}% susut
                      </strong>
                    )}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: 0.2 },
                      }}
                      className="overflow-hidden"
                    >
                      <div className="grid gap-4 border-t border-[var(--glass-border)] bg-black/[0.018] p-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                        <div className="space-y-3">
                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-[var(--glass-border)] bg-[var(--glass-border)]">
                            <StatCard
                              icon={<Thermometer size={14} />}
                              label="Charge Temp"
                              value={
                                roast.chargeTemperature
                                  ? `${roast.chargeTemperature}°C`
                                  : "-"
                              }
                            />
                            <StatCard
                              icon={<Thermometer size={14} />}
                              label="Drop Temp"
                              value={
                                roast.dropTemperature
                                  ? `${roast.dropTemperature}°C`
                                  : "-"
                              }
                            />
                            <StatCard
                              icon={<Clock size={14} />}
                              label="First Crack"
                              value={
                                roast.firstCrackStartTime
                                  ? formatDuration(roast.firstCrackStartTime)
                                  : "-"
                              }
                            />
                            <StatCard
                              icon={<Flame size={14} />}
                              label="Duration"
                              value={formatDuration(roast.duration)}
                            />
                          </div>

                          {/* Weight */}
                          {(roast.greenWeightGrams ||
                            roast.roastedWeightGrams) && (
                            <div className="grid grid-cols-3 gap-2 rounded-[12px] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 text-xs tabular-nums">
                              {roast.greenWeightGrams && (
                                <span className="text-[var(--text-secondary)]">
                                  Green:{" "}
                                  <strong>{roast.greenWeightGrams}g</strong>
                                </span>
                              )}
                              {roast.roastedWeightGrams && (
                                <span className="text-[var(--text-secondary)]">
                                  Roasted:{" "}
                                  <strong>{roast.roastedWeightGrams}g</strong>
                                </span>
                              )}
                              {roast.lossPercent != null && (
                                <span className="text-[var(--text-secondary)]">
                                  Loss:{" "}
                                  <strong className="text-amber-600">
                                    {roast.lossPercent.toFixed(1)}%
                                  </strong>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Metadata */}
                          {roast.metadata &&
                            Object.keys(roast.metadata).length > 0 && (
                              <div className="space-y-1 rounded-[12px] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 text-xs text-[var(--text-tertiary)]">
                                <MetadataField
                                  meta={roast.metadata}
                                  key_="roaster"
                                  label="Roaster"
                                />
                                <MetadataField
                                  meta={roast.metadata}
                                  key_="profile"
                                  label="Profile"
                                />
                                <MetadataField
                                  meta={roast.metadata}
                                  key_="beans"
                                  label="Beans"
                                />
                              </div>
                            )}

                          {/* Link to Batch Button */}
                          <LinkToBatchButton
                            roastId={roast.id}
                            roastTitle={roast.title || "Untitled"}
                          />
                        </div>

                        {/* Temperature Curve Chart */}
                        {roast.beanTemperatureSeries &&
                          roast.beanTemperatureSeries.length > 0 && (
                            <div className="min-w-0">
                              <div className="mb-2 flex items-center justify-between">
                                <h4 className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                                  Kurva temperatur
                                </h4>
                                <span className="text-[10px] text-[var(--text-tertiary)]">
                                  {roast.beanTemperatureSeries.length} titik
                                  data
                                </span>
                              </div>
                              <TemperatureChart
                                btData={roast.beanTemperatureSeries}
                                etData={roast.environmentalTemperatureSeries}
                                events={roast.events}
                              />
                            </div>
                          )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[var(--glass-bg)] p-3">
      <div className="flex items-center gap-1.5 text-[var(--text-tertiary)] mb-1">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-sm font-black tabular-nums text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function MetadataField({
  meta,
  key_,
  label,
}: {
  meta: Record<string, unknown>;
  key_: string;
  label: string;
}) {
  const val = meta[key_];
  if (val == null || val === "") return null;
  return (
    <p>
      {label}: <strong>{String(val)}</strong>
    </p>
  );
}

function TemperatureChart({
  btData,
  etData,
  events,
}: {
  btData: Array<{ second: number; value: number }>;
  etData: Array<{ second: number; value: number }> | null;
  events: Array<{ second: number; type: string }> | null;
}) {
  // Merge BT and ET data by second
  const chartData = btData.map((bt) => {
    const et = etData?.find((e) => e.second === bt.second);
    return {
      time: bt.second,
      timeLabel: `${Math.floor(bt.second / 60)}:${String(bt.second % 60).padStart(2, "0")}`,
      BT: bt.value,
      ET: et?.value ?? null,
    };
  });

  // Find event positions
  const eventMarkers =
    events?.filter((e) =>
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
    <div className="rounded-[12px] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[9px]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-500 rounded" />
          <span className="text-[var(--text-tertiary)]">BT (Bean Temp)</span>
        </span>
        {etData && etData.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-400 rounded" />
            <span className="text-[var(--text-tertiary)]">ET (Env Temp)</span>
          </span>
        )}
        {eventMarkers.map((e) => (
          <span
            key={`${e.type}-${e.second}`}
            className="flex items-center gap-1"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: eventColors[e.type] || "#999" }}
            />
            <span className="text-[var(--text-tertiary)]">{e.type}</span>
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={214}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          <XAxis
            dataKey="time"
            tickFormatter={(v) =>
              `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`
            }
            stroke="var(--text-tertiary)"
            fontSize={10}
            tickLine={false}
          />
          <YAxis
            stroke="var(--text-tertiary)"
            fontSize={10}
            tickLine={false}
            domain={["dataMin - 10", "dataMax + 10"]}
          />
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
          {/* Event reference lines */}
          {eventMarkers.map((e) => (
            <ReferenceLine
              key={`${e.type}-${e.second}`}
              x={e.second}
              stroke={eventColors[e.type] || "#999"}
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
          ))}
          <Line
            type="monotone"
            dataKey="BT"
            stroke="#00668E"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          {etData && etData.length > 0 && (
            <Line
              type="monotone"
              dataKey="ET"
              stroke="#60a5fa"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="5 5"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LinkToBatchButton({
  roastId,
  roastTitle,
}: {
  roastId: string;
  roastTitle: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [batches, setBatches] = useState<
    Array<{
      id: string;
      code: string;
      status: string;
      roastId: string | null;
      inputProduct: { name: string };
      outputProduct: { name: string };
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/roasting/batches", {
        credentials: "include",
      });
      const data = await res.json();
      setBatches(data.batches || []);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (batchId: string) => {
    setLinking(true);
    try {
      const res = await fetch("/api/roasting/link-roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ batchId, roastId }),
      });
      const data = await res.json();
      if (data.success) {
        setIsOpen(false);
        window.location.reload();
      } else {
        alert(data.error || "Gagal menghubungkan.");
      }
    } catch {
      alert("Gagal menghubungkan.");
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          fetchBatches();
        }}
        className="w-full rounded-[10px] border border-[var(--domain-roasting)]/25 bg-[var(--domain-roasting)]/[0.06] px-3 py-2 text-xs font-bold text-[var(--domain-roasting)] transition hover:bg-[var(--domain-roasting)]/[0.12]"
      >
        Hubungkan ke batch produksi
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              Hubungkan ke Batch
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Pilih batch roasting untuk menghubungkan roast &quot;{roastTitle}
              &quot;.
            </p>

            {loading ? (
              <p className="text-sm text-[var(--text-tertiary)]">
                Memuat batch...
              </p>
            ) : batches.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">
                Tidak ada batch yang tersedia. Buat batch terlebih dahulu di
                halaman Roasting.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {batches.map((batch) => (
                  <button
                    key={batch.id}
                    onClick={() => handleLink(batch.id)}
                    disabled={linking || !!batch.roastId}
                    className="w-full text-left rounded-xl border border-[var(--glass-border)] p-3 hover:bg-[var(--glass-bg-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-[var(--text-primary)]">
                        {batch.code}
                      </p>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          batch.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : batch.status === "PENDING"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-gray-500/10 text-gray-500"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                      {batch.inputProduct.name} → {batch.outputProduct.name}
                    </p>
                    {batch.roastId && (
                      <p className="text-[10px] text-amber-600 mt-1">
                        Sudah terhubung ke roast lain
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setIsOpen(false)}
              className="mt-4 w-full rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] transition"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </>
  );
}
