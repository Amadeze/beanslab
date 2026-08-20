"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";

interface OriginSnapshot {
  id?: string | null;
  label?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  postalCode?: string | null;
}

interface DestinationResult {
  providerId: string;
  label: string;
  province?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  postalCode?: string;
  token: string;
}

export function OriginSearchPicker({ initial }: { initial: OriginSnapshot }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DestinationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(
    initial.id ? null : null
  );
  const [selectedLabel, setSelectedLabel] = useState<string | null>(
    initial.label ?? null
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/tenant/shipping/origin-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const body = await res.json();
        if (body.integrationDisabled) {
          setError("Integrasi RajaOngkir belum aktif di platform.");
          setResults([]);
        } else if (body.error) {
          setError("Pencarian gagal. Coba lagi.");
          setResults([]);
        } else {
          setResults(body.results ?? []);
          setError(null);
        }
      } catch {
        setError("Pencarian gagal. Coba lagi.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function choose(d: DestinationResult) {
    setSelectedToken(d.token);
    setSelectedLabel(d.label);
    setQuery("");
    setResults([]);
    setError(null);
  }

  return (
    <div className="rounded-lg border border-stone-200 p-4">
      <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
        Cari lokasi asal (RajaOngkir)
      </label>
      <div className="relative mt-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="kota / kecamatan / kelurahan / kode pos"
          className="h-11 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
        />
      </div>

      {loading && <p className="mt-2 text-xs text-stone-400">Mencari…</p>}
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-2 max-h-56 overflow-auto rounded-lg border border-stone-200">
          {results.map((d) => (
            <li key={d.providerId}>
              <button
                type="button"
                onClick={() => choose(d)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-stone-400" />
                <span>{d.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm">
        {selectedLabel ? (
          <span className="flex items-center gap-2 text-stone-800">
            <MapPin size={14} className="text-stone-500" />
            {selectedLabel}
          </span>
        ) : (
          <span className="text-stone-400">Belum memilih lokasi asal.</span>
        )}
      </div>

      {/* Single hidden input with the tamper-evident server token */}
      <input type="hidden" name="rajaOngkirOriginToken" value={selectedToken ?? ""} />
    </div>
  );
}