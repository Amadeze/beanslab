"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseReportDataResult<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
};

export function useReportData<T>(fetcher: () => Promise<T>, deps: unknown[]): UseReportDataResult<T> {
  const depsKey = JSON.stringify(deps);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const prevDepsKey = useRef(depsKey);

  useEffect(() => {
    if (prevDepsKey.current !== depsKey) {
      prevDepsKey.current = depsKey;
      setData(null);
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Gagal memuat laporan:", err);
        setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat laporan.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, attempt]);

  const retry = useCallback(() => {
    setAttempt((a) => a + 1);
    setLoading(true);
  }, []);

  return { data, error, loading, retry };
}
