"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldX, KeyRound, Activity } from "lucide-react";
import {
  saveRajaOngkirApiKey,
  testRajaOngkirConnection,
  type RajaOngkirSaveResult,
  type RajaOngkirTestResult,
} from "../actions";

interface InitialState {
  isConfigured: boolean;
  isActive: boolean;
  maskedKey?: string;
  lastTestedAt: string | null;
  connectionStatus: string | null;
  lastConnectionError: string | null;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
      <ShieldCheck size={13} /> Aktif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-200 px-3 py-1 text-xs font-bold text-stone-600">
      <ShieldX size={13} /> Nonaktif
    </span>
  );
}

export function RajaOngkirSettingsClient({ initial }: { initial: InitialState }) {
  const [state, setState] = useState<InitialState>(initial);
  const [apiKey, setApiKey] = useState("");
  const [saveMsg, setSaveMsg] = useState<RajaOngkirSaveResult | null>(null);
  const [testMsg, setTestMsg] = useState<RajaOngkirTestResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(formData: FormData) {
    setSaveMsg(null);
    startTransition(async () => {
      const result = await saveRajaOngkirApiKey(formData);
      setSaveMsg(result);
      if (result.success) {
        setApiKey("");
        setState((prev) => ({ ...prev, isConfigured: true, isActive: true }));
      }
    });
  }

  function handleTest() {
    setTestMsg(null);
    startTransition(async () => {
      const result = await testRajaOngkirConnection();
      setTestMsg(result);
      setState((prev) => ({
        ...prev,
        connectionStatus: result.status,
        lastTestedAt: new Date().toISOString(),
        lastConnectionError: result.success ? null : result.error,
      }));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black">Status integrasi</h3>
          <StatusBadge active={state.isActive} />
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shipping Cost API Key</dt>
            <dd className="mt-1 flex items-center gap-2 font-mono">
              <KeyRound size={14} className="text-muted-foreground" />
              {state.maskedKey ?? "Belum diatur"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Terakhir dites</dt>
            <dd className="mt-1">
              {state.lastTestedAt
                ? new Date(state.lastTestedAt).toLocaleString("id-ID")
                : "Belum pernah"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status koneksi</dt>
            <dd className="mt-1 flex items-center gap-1.5">
              <Activity size={14} className="text-muted-foreground" />
              {state.connectionStatus ?? "UNKNOWN"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ringkasan error</dt>
            <dd className="mt-1 text-muted-foreground">
              {state.lastConnectionError ?? "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={isPending || !state.isConfigured}
            className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"
          >
            Test Koneksi
          </button>
          {testMsg && (
            <span className={testMsg.success ? "text-sm font-semibold text-emerald-600" : "text-sm font-semibold text-red-600"}>
              {testMsg.success ? "Koneksi berhasil." : testMsg.error}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-black">Simpan / Ganti API Key</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Base URL dikendalikan oleh aplikasi dan tidak dapat diubah.
        </p>
        <form action={handleSave} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Shipping Cost API Key
            <input
              name="apiKey"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
              placeholder="tempel API key RajaOngkir"
            />
          </label>
          <button
            type="submit"
            disabled={isPending || apiKey.trim().length < 10}
            className="h-11 rounded-lg bg-stone-900 px-5 text-sm font-black text-white hover:bg-stone-800 disabled:opacity-50"
          >
            Simpan
          </button>
        </form>
        {saveMsg && (
          <p className={saveMsg.success ? "mt-3 text-sm font-semibold text-emerald-600" : "mt-3 text-sm font-semibold text-red-600"}>
            {saveMsg.success ? "API Key tersimpan (terenkripsi)." : saveMsg.error}
          </p>
        )}
      </section>
    </div>
  );
}
