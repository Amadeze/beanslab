"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { revokeConnector } from "../actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Unlink,
  Download,
  Monitor,
  Clock,
  CheckCircle2,
  Wifi,
  WifiOff,
} from "lucide-react";

type Connector = {
  id: string;
  computerName: string;
  platform: string;
  appVersion: string;
  status: string;
  isOnline: boolean | null;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  machine: { id: string; name: string };
};

type Props = {
  connectors: Connector[];
  downloadUrl: string | null;
};

type LiveSession = {
  id: string;
  sessionId: string;
  machineId: string;
  status: string;
  currentBT: number | null;
  currentET: number | null;
  lastUpdateAt: string;
  machine: { name: string };
};

type LivePoint = {
  sourceAt: string;
  time: string;
  BT: number | null;
  ET: number | null;
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "-";
  // Use a static string on server, will be updated on client via useEffect
  return new Date(iso).toLocaleString("id-ID");
}

export function ArtisanIntegrationClient({
  connectors: initialConnectors,
  downloadUrl,
}: Props) {
  const [connectors, setConnectors] = useState(initialConnectors);
  const [connectorToRevoke, setConnectorToRevoke] = useState<string | null>(null);
  const [connectorToDelete, setConnectorToDelete] = useState<string | null>(null);

  useEffect(() => {
    const refreshConnectors = async () => {
      try {
        const response = await fetch("/api/integrations/artisan/connectors", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data.connectors)) {
          setConnectors(data.connectors);
        }
      } catch {
        // Keep the last known state when the status poll is interrupted.
      }
    };

    const interval = window.setInterval(refreshConnectors, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  async function handleRevoke(connectorId: string) {
    setConnectorToRevoke(connectorId);
  }
  
  async function confirmRevoke() {
    if (!connectorToRevoke) return;
    const result = await revokeConnector(connectorToRevoke);
    if (result.success) {
      toast.success("Koneksi berhasil dicabut.");
      setConnectors((prev) => prev.map(c => c.id === connectorToRevoke ? { ...c, status: 'REVOKED' } : c));
    } else {
      toast.error(result.error);
    }
    setConnectorToRevoke(null);
  }

  async function handleDelete(connectorId: string) {
    setConnectorToDelete(connectorId);
  }
  
  async function confirmDelete() {
    if (!connectorToDelete) return;
    try {
      const res = await fetch("/api/integrations/artisan/connectors/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ connectorId: connectorToDelete }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Koneksi berhasil dihapus.");
        // Refresh connectors list
        setConnectors((prev) => prev.filter((c) => c.id !== connectorToDelete));
      } else {
        toast.error(data.error || "Gagal menghapus.");
      }
    } catch {
      toast.error("Koneksi belum dapat dihapus.");
    }
    setConnectorToDelete(null);
  }

  return (
    <div className="space-y-8">
      {/* Browser login guidance */}
      <section className="glass-card rounded-2xl p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-[var(--text-primary)]">
          <Monitor size={18} className="text-[var(--amber-warm)]" />
          Masuk langsung dari Roastd Studio
        </h3>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Buka aplikasi desktop dan tekan <strong>Masuk dengan Roastd</strong>.
          Browser akan meminta Anda memilih mesin, lalu Studio tersambung otomatis.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {["Buka Studio", "Login di browser", "Pilih mesin"].map((label, index) => (
            <div key={label} className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              <span className="mr-2 font-mono text-xs font-bold text-[var(--amber-warm)]">0{index + 1}</span>
              {label}
            </div>
          ))}
        </div>

      </section>

      {/* Download Section */}
      <section className="glass-card rounded-2xl p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-[var(--text-primary)]">
          <Download size={18} className="text-[var(--amber-warm)]" />
          Download Roastd Studio
        </h3>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Instal logger desktop read-only untuk melihat telemetry dan menyinkronkan
          hasil roasting ke roastd.id secara otomatis. Artisan tetap opsional.
        </p>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--amber-warm)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
          >
            <Download size={16} />
            Download untuk Windows
          </a>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">
            Link download belum dikonfigurasi oleh admin.
          </p>
        )}
      </section>

      {/* Connectors List */}
      <section className="glass-card rounded-2xl p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-[var(--text-primary)]">
          <Monitor size={18} className="text-[var(--amber-warm)]" />
          Perangkat Studio
        </h3>

        {connectors.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            Belum ada perangkat. Buka Studio dan pilih Masuk dengan Roastd.
          </p>
        ) : (
          <div className="space-y-3">
            {connectors.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 rounded-xl border border-[var(--glass-border)] p-4 transition hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--glass-bg)]">
                  {c.isOnline ? (
                    <Wifi className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-[var(--text-tertiary)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--text-primary)]">
                      {c.computerName}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                        c.status === "REVOKED"
                          ? "bg-red-500/10 text-red-500"
                          : c.isOnline
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-gray-500/10 text-gray-500"
                      }`}
                    >
                      {c.status === "REVOKED"
                        ? "Dicabut"
                        : c.isOnline
                          ? "Online"
                          : "Offline"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {c.machine.name} · {c.platform} · v{c.appVersion}
                  </p>
                  <div className="mt-1 flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Terakhir online: {formatRelativeTime(c.lastSeenAt)}
                    </span>
                    {c.lastSyncAt && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Sync: {formatRelativeTime(c.lastSyncAt)}
                      </span>
                    )}
                  </div>
                </div>
                {c.status !== "REVOKED" ? (
                  <button
                    onClick={() => handleRevoke(c.id)}
                    className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500 transition"
                    title="Putuskan"
                  >
                    <Unlink size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500 transition"
                    title="Hapus"
                  >
                    <span className="text-xs">Hapus</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!connectorToRevoke} onOpenChange={(open) => !open && setConnectorToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Putuskan Connector?</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin memutuskan connector ini? Koneksi dengan mesin roaster akan terhenti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={confirmRevoke}>
              Ya, Putuskan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!connectorToDelete} onOpenChange={(open) => !open && setConnectorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Connector?</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus connector ini? Data tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDelete}>
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Live Telemetry */}
      <LiveTelemetrySection />
    </div>
  );
}

function LiveTelemetrySection() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveData, setLiveData] = useState<LivePoint[]>([]);
  const activeChartSessionRef = useRef<string | null>(null);
  const lastSourceAtRef = useRef<string | null>(null);

  const ingestSessions = useCallback((incoming: LiveSession[]) => {
    const seen = new Map<string, LiveSession>();
    for (const session of incoming) {
      const existing = seen.get(session.machineId);
      if (
        !existing ||
        new Date(session.lastUpdateAt).getTime() >
          new Date(existing.lastUpdateAt).getTime()
      ) {
        seen.set(session.machineId, session);
      }
    }

    const nextSessions = Array.from(seen.values());
    setSessions(nextSessions);
    const latest = nextSessions[0];

    if (!latest) {
      activeChartSessionRef.current = null;
      lastSourceAtRef.current = null;
      setLiveData([]);
      return;
    }

    if (
      (latest.currentBT == null && latest.currentET == null) ||
      lastSourceAtRef.current === latest.lastUpdateAt
    ) {
      return;
    }

    const newPoint: LivePoint = {
      sourceAt: latest.lastUpdateAt,
      time: new Date(latest.lastUpdateAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      BT: latest.currentBT,
      ET: latest.currentET,
    };

    if (activeChartSessionRef.current !== latest.sessionId) {
      activeChartSessionRef.current = latest.sessionId;
      setLiveData([newPoint]);
    } else {
      setLiveData((previous) => [...previous.slice(-29), newPoint]);
    }
    lastSourceAtRef.current = latest.lastUpdateAt;
  }, []);

  const fetchLive = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch("/api/integrations/artisan/mqtt/live", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Telemetry request failed");
        const data = await res.json();
        ingestSessions(Array.isArray(data.sessions) ? data.sessions : []);
      } catch {
        ingestSessions([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [ingestSessions],
  );

  useEffect(() => {
    void fetchLive();
    const interval = window.setInterval(() => void fetchLive(), 3_000);
    return () => window.clearInterval(interval);
  }, [fetchLive]);

  return (
    <section className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
          <Wifi size={18} className="text-[var(--amber-warm)]" />
          Live Telemetry
        </h3>
        <button
          onClick={() => void fetchLive(true)}
          disabled={loading}
          className="rounded-xl border border-[var(--glass-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] transition"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">
          Belum ada data live. Data akan muncul saat Studio menerima telemetry mesin.
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-[var(--glass-border)] p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--text-primary)]">
                  {s.machine.name}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600">
                  LIVE
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-xs">
                <span className="text-[var(--text-secondary)]">
                  BT: <strong>{s.currentBT?.toFixed(1) ?? "-"}°C</strong>
                </span>
                <span className="text-[var(--text-secondary)]">
                  ET: <strong>{s.currentET?.toFixed(1) ?? "-"}°C</strong>
                </span>
                <span className="text-[var(--text-tertiary)]">
                  {formatRelativeTime(s.lastUpdateAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Chart */}
      {sessions.length > 0 && liveData.length === 1 && (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--glass-border)] px-4 py-8 text-center">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Menunggu titik telemetry berikutnya…
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Grafik dimulai setelah dua pembaruan berbeda diterima.
          </p>
        </div>
      )}

      {sessions.length > 0 && liveData.length >= 2 && (
        <div className="mt-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
          <p className="text-xs font-bold text-[var(--text-tertiary)] mb-3">
            LIVE BT/ET
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart
              data={liveData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: "var(--text-tertiary)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["dataMin - 10", "dataMax + 10"]}
                tick={{ fontSize: 9, fill: "var(--text-tertiary)" }}
                width={35}
                tickFormatter={(v) => `${v}°`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--glass-bg-hover)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "8px",
                  fontSize: "10px",
                }}
                formatter={(value, name) => [
                  `${Number(value)?.toFixed(1)}°C`,
                  String(name),
                ]}
              />
              <Line
                type="monotone"
                dataKey="BT"
                stroke="#00668E"
                strokeWidth={2}
                dot={false}
                name="Bean Temp"
                isAnimationActive={true}
                animationDuration={500}
              />
              <Line
                type="monotone"
                dataKey="ET"
                stroke="#60a5fa"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="5 5"
                name="Env Temp"
                isAnimationActive={true}
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-2 text-[11px] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-1 bg-amber-500 rounded" />
              <span className="text-[var(--text-secondary)]">
                BT (Bean Temp)
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-4 h-1 bg-blue-400 rounded"
                style={{ borderTop: "1px dashed #60a5fa" }}
              />
              <span className="text-[var(--text-secondary)]">
                ET (Env Temp)
              </span>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
