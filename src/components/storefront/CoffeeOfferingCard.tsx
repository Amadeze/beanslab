"use client";

import { useMemo, useState } from "react";
import { Coffee, Minus, Plus, ShoppingBag } from "lucide-react";

import {
  STOREFRONT_GRIND_LABEL,
  type StorefrontGrindSize,
  type StorefrontOffering,
} from "@/lib/storefront-grind";

type OfferingVariant = StorefrontOffering["variants"][number];

export type CoffeeOfferingSelection = {
  offering: StorefrontOffering;
  variant: OfferingVariant;
  grindSize: StorefrontGrindSize;
  customGrindLabel: string | null;
  quantity: number;
};

type CoffeeOfferingCardProps = {
  offering: StorefrontOffering;
  onAdd?: (selection: CoffeeOfferingSelection) => void;
  preview?: boolean;
};

function maxPackages(availableKg: number | null | undefined, netWeightGrams: number) {
  if (availableKg == null) return null;
  if (!Number.isFinite(availableKg) || availableKg <= 0 || netWeightGrams <= 0) return 0;
  return Math.floor((availableKg * 1000 + 0.0001) / netWeightGrams);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CoffeeOfferingCard({ offering, onAdd, preview = false }: CoffeeOfferingCardProps) {
  const grindOptions = useMemo(() => {
    const options = [...(offering.grindOptions ?? [])];
    const allowed = offering.allowCustomGrind
      ? options
      : options.filter((option) => option !== "CUSTOM");
    return allowed.length > 0 ? allowed : (["WHOLE_BEAN"] as StorefrontGrindSize[]);
  }, [offering.allowCustomGrind, offering.grindOptions]);

  const selectableVariants = useMemo(
    () => offering.variants.filter((variant) => (maxPackages(offering.availableKg, variant.netWeightGrams) ?? 1) > 0),
    [offering.availableKg, offering.variants],
  );
  const [variantId, setVariantId] = useState(() => selectableVariants[0]?.id ?? offering.variants[0]?.id ?? "");
  const [grindSize, setGrindSize] = useState<StorefrontGrindSize>(grindOptions[0] ?? "WHOLE_BEAN");
  const [customGrindLabel, setCustomGrindLabel] = useState("");
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = offering.variants.find((variant) => variant.id === variantId)
    ?? selectableVariants[0]
    ?? offering.variants[0];
  const packageLimit = selectedVariant
    ? maxPackages(offering.availableKg, selectedVariant.netWeightGrams)
    : 0;
  const sourceUnavailable = Boolean(offering.unavailableReason || !offering.lineageProductId);
  const selectionUnavailable = sourceUnavailable || !selectedVariant || packageLimit === 0;
  const customMissing = grindSize === "CUSTOM" && !customGrindLabel.trim();
  const canAdd = !selectionUnavailable && !customMissing && quantity > 0 && (packageLimit == null || quantity <= packageLimit);

  const chooseVariant = (nextId: string) => {
    const next = offering.variants.find((variant) => variant.id === nextId);
    setVariantId(nextId);
    const nextLimit = next ? maxPackages(offering.availableKg, next.netWeightGrams) : 0;
    setQuantity((current) => Math.max(1, Math.min(current, nextLimit ?? current)));
  };

  const add = () => {
    if (!canAdd || !selectedVariant) return;
    onAdd?.({
      offering,
      variant: selectedVariant,
      grindSize,
      customGrindLabel: grindSize === "CUSTOM" ? customGrindLabel.trim() : null,
      quantity,
    });
    if (!preview) setQuantity(1);
  };

  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-[1.35rem] border shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{
        backgroundColor: "var(--portal-surface, var(--t-surface, #fff))",
        borderColor: "var(--portal-border-subtle, var(--t-border, #e5e7eb))",
        color: "var(--portal-text, var(--t-text, #1a1a1a))",
      }}
    >
      <div
        className="relative aspect-[16/10] overflow-hidden"
        style={{ backgroundColor: "var(--portal-surface-alt, var(--t-bg, #f4f4f2))" }}
      >
        {offering.imageUrl ? (
          <img src={offering.imageUrl} alt={offering.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center" aria-hidden="true">
            <Coffee className="h-12 w-12 opacity-30" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
          {offering.roastLevel?.replaceAll("_", " ") || "Roastery selection"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] opacity-55">
            {offering.coffeeSource?.name || "Coffee offering"}
          </p>
          <h3 className="text-xl font-semibold leading-tight">{offering.name}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 opacity-65">
            {offering.description || "Pilih kemasan dan gilingan sesuai cara seduhmu."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">
            Ukuran
            <select
              aria-label={`Ukuran ${offering.name}`}
              value={selectedVariant?.id ?? ""}
              onChange={(event) => chooseVariant(event.target.value)}
              disabled={sourceUnavailable || offering.variants.length === 0}
              className="mt-1.5 h-11 w-full rounded-xl border bg-transparent px-3 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              style={{ borderColor: "var(--portal-border, var(--t-border, #d1d5db))" }}
            >
              {offering.variants.map((variant) => {
                const limit = maxPackages(offering.availableKg, variant.netWeightGrams);
                return (
                  <option key={variant.id} value={variant.id} disabled={limit === 0}>
                    {variant.packageName} · {variant.netWeightGrams.toLocaleString("id-ID")} g{limit === 0 ? " · habis" : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="text-xs font-semibold">
            Bentuk kopi
            <select
              aria-label={`Gilingan ${offering.name}`}
              value={grindSize}
              onChange={(event) => setGrindSize(event.target.value as StorefrontGrindSize)}
              disabled={selectionUnavailable}
              className="mt-1.5 h-11 w-full rounded-xl border bg-transparent px-3 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              style={{ borderColor: "var(--portal-border, var(--t-border, #d1d5db))" }}
            >
              {grindOptions.map((option) => <option key={option} value={option}>{STOREFRONT_GRIND_LABEL[option]}</option>)}
            </select>
          </label>
        </div>

        {grindSize === "CUSTOM" ? (
          <label className="text-xs font-semibold">
            Catatan gilingan
            <input
              value={customGrindLabel}
              onChange={(event) => setCustomGrindLabel(event.target.value)}
              placeholder="Contoh: Comandante 22 klik"
              className="mt-1.5 h-11 w-full rounded-xl border bg-transparent px-3 text-sm"
              style={{ borderColor: "var(--portal-border, var(--t-border, #d1d5db))" }}
            />
          </label>
        ) : null}

        <div className="mt-auto rounded-2xl border p-3" style={{ borderColor: "var(--portal-border-subtle, var(--t-border, #e5e7eb))" }}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] opacity-55">Harga</p>
              <p className="text-lg font-bold" style={{ color: "var(--portal-primary, var(--t-primary, #6b4423))" }}>
                {selectedVariant ? formatRupiah(selectedVariant.unitPrice) : "—"}
              </p>
            </div>
            <p className="text-right text-xs opacity-60" aria-live="polite">
              {offering.unavailableReason
                ? offering.unavailableReason
                : packageLimit == null
                  ? "Tersedia"
                  : packageLimit > 0
                    ? `Sisa ${Number(offering.availableKg).toLocaleString("id-ID")} kg · maks. ${packageLimit} paket`
                    : "Ukuran ini belum tersedia"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-11 items-center rounded-xl border" style={{ borderColor: "var(--portal-border, var(--t-border, #d1d5db))" }}>
            <button type="button" aria-label="Kurangi jumlah" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} className="grid h-11 w-10 place-items-center rounded-l-xl disabled:opacity-30">
              <Minus className="h-4 w-4" />
            </button>
            <output className="w-9 text-center text-sm font-semibold" aria-label={`${quantity} paket`}>{quantity}</output>
            <button type="button" aria-label="Tambah jumlah" onClick={() => setQuantity((value) => Math.min(value + 1, packageLimit ?? value + 1))} disabled={packageLimit != null && quantity >= packageLimit} className="grid h-11 w-10 place-items-center rounded-r-xl disabled:opacity-30">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={add}
            disabled={!canAdd || (!onAdd && !preview)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            style={{ backgroundColor: "var(--portal-primary, var(--t-accent, #6b4423))" }}
          >
            <ShoppingBag className="h-4 w-4" />
            {selectionUnavailable ? "Belum tersedia" : customMissing ? "Isi catatan gilingan" : preview ? "Pratinjau" : "Tambah ke keranjang"}
          </button>
        </div>
      </div>
    </article>
  );
}
