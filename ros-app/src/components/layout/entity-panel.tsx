"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * EntityPanel — satu panel kanan untuk SELURUH aplikasi.
 * Halaman memanggil show({ key, content }) saat baris/entri dipilih;
 * shell merender konten itu menggantikan ringkasan default.
 * key dipakai agar konten yang sama tidak di-set ulang berulang.
 */
export type PanelEntity = {
  key: string;
  eyebrow?: string;
  title: string;
  content: React.ReactNode;
};

type EntityPanelValue = {
  entity: PanelEntity | null;
  show: (entity: PanelEntity) => void;
  clear: () => void;
};

const EntityPanelContext = createContext<EntityPanelValue | null>(null);

export function EntityPanelProvider({ children }: { children: React.ReactNode }) {
  const [entity, setEntity] = useState<PanelEntity | null>(null);
  const value = useMemo(
    () => ({
      entity,
      show: (next: PanelEntity) =>
        setEntity((prev) => (prev && prev.key === next.key ? prev : next)),
      clear: () => setEntity(null),
    }),
    [entity],
  );

  return <EntityPanelContext.Provider value={value}>{children}</EntityPanelContext.Provider>;
}

export function useEntityPanel(): EntityPanelValue {
  const ctx = useContext(EntityPanelContext);
  if (!ctx) {
    // Fallback aman bila halaman dipakai di luar shell (mis. preview terisolasi).
    return { entity: null, show: () => undefined, clear: () => undefined };
  }
  return ctx;
}
