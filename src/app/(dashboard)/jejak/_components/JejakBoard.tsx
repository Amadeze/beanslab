"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, Flame, FlaskConical, Factory, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JejakBoard, JejakBatch, JejakCupping, JejakLot, JejakOutput } from "../actions";

type Selected = { kind: "lot" | "batch" | "cupping" | "output"; id: string } | null;

/**
 * Papan Peta Jejak — 4 kolom alur dengan penyorotan rantai.
 * Klik kartu = sorot rantainya (kolom lain redup). Klik lagi = bersihkan.
 */
export function JejakBoard({ board }: { board: JejakBoard }) {
  const [selected, setSelected] = useState<Selected>(null);
  const [query, setQuery] = useState("");

  // Indeks koneksi: lot→batchIds, batch→{lotIds, cuppings, outputs}
  const lotToBatches = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const b of board.batches)
      for (const lotId of b.lotIds) {
        if (!m.has(lotId)) m.set(lotId, new Set());
        m.get(lotId)!.add(b.id);
      }
    return m;
  }, [board.batches]);

  const chainIds = useMemo(() => {
    if (!selected) return null;
    const lots = new Set<string>();
    const batches = new Set<string>();
    const cuppings = new Set<string>();
    const outputs = new Set<string>();

    if (selected.kind === "lot") {
      lots.add(selected.id);
      for (const b of lotToBatches.get(selected.id) ?? []) {
        batches.add(b);
        for (const c of board.cuppings.filter((x) => x.batchId === b)) cuppings.add(c.id);
        for (const o of board.outputs.filter((x) => x.batchId === b)) outputs.add(o.id);
      }
    } else if (selected.kind === "batch") {
      batches.add(selected.id);
      const b = board.batches.find((x) => x.id === selected.id);
      for (const lotId of b?.lotIds ?? []) lots.add(lotId);
      for (const c of board.cuppings.filter((x) => x.batchId === selected.id)) cuppings.add(c.id);
      for (const o of board.outputs.filter((x) => x.batchId === selected.id)) outputs.add(o.id);
    } else if (selected.kind === "cupping") {
      const c = board.cuppings.find((x) => x.id === selected.id);
      cuppings.add(selected.id);
      if (c?.batchId) {
        batches.add(c.batchId);
        const b = board.batches.find((x) => x.id === c.batchId);
        for (const lotId of b?.lotIds ?? []) lots.add(lotId);
        for (const o of board.outputs.filter((x) => x.batchId === c.batchId)) outputs.add(o.id);
      }
    } else {
      outputs.add(selected.id);
      const o = board.outputs.find((x) => x.id === selected.id);
      if (o?.batchId) {
        batches.add(o.batchId);
        const b = board.batches.find((x) => x.id === o.batchId);
        for (const lotId of b?.lotIds ?? []) lots.add(lotId);
        for (const cc of board.cuppings.filter((x) => x.batchId === o.batchId)) cuppings.add(cc.id);
      }
    }
    return { lots, batches, cuppings, outputs };
  }, [selected, board]);

  const q = query.trim().toLocaleLowerCase("id-ID");
  const matchText = (...parts: Array<string | null | undefined>) =>
    !q || parts.some((p) => p?.toLocaleLowerCase("id-ID").includes(q));

  const dim = (kind: Exclude<Selected, null>["kind"], id: string) => {
    if (!chainIds) return false;
    const key =
      kind === "lot" ? "lots" : kind === "batch" ? "batches" : kind === "cupping" ? "cuppings" : "outputs";
    return !chainIds[key].has(id);
  };

  function toggle(kind: Exclude<Selected, null>["kind"], id: string) {
    setSelected((prev) => (prev && prev.kind === kind && prev.id === id ? null : { kind, id }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" size={15} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kode lot / batch / produk…"
            className="h-10 w-full rounded-card border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <p className="text-xs text-ink-tertiary">
          Klik kartu untuk menyorot rantainya. Kartu putus-putus merah = perlu perhatian.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {/* KOLOM 1 — LOT */}
        <Column icon={Boxes} title="Lot hidup" count={board.lots.length}>
          {board.lots.map((lot) => (
            <NodeCard
              key={lot.id}
              kind="lot"
              id={lot.id}
              dimmed={dim("lot", lot.id)}
              active={selected?.kind === "lot" && selected.id === lot.id}
              onClick={() => toggle("lot", lot.id)}
              visible={matchText(lot.code, lot.supplier)}
              title={lot.code}
              sub={`${lot.kg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kg${lot.supplier ? ` · ${lot.supplier}` : ""}`}
            />
          ))}
        </Column>

        {/* KOLOM 2 — BATCH */}
        <Column icon={Flame} title="Batch roasting" count={board.batches.length}>
          {board.batches.map((b: JejakBatch) => (
            <NodeCard
              key={b.id}
              kind="batch"
              id={b.id}
              dimmed={dim("batch", b.id)}
              active={selected?.kind === "batch" && selected.id === b.id}
              onClick={() => toggle("batch", b.id)}
              visible={matchText(b.code, b.inputName, b.outputName)}
              href={`/roasting/batch/${b.id}`}
              warn={b.status !== "COMPLETED"}
              title={b.code}
              sub={[b.inputName, b.outputName].filter(Boolean).join(" → ") || undefined}
              footer={
                b.lotIds.length > 0 ? (
                  <span className="font-mono text-[9px] text-ink-tertiary">{b.lotIds.length} lot</span>
                ) : (
                  <span className="rounded border border-dashed border-border px-1 font-mono text-[8px] uppercase text-ink-tertiary">tanpa lot tercatat</span>
                )
              }
            />
          ))}
        </Column>

        {/* KOLOM 3 — CUPPING */}
        <Column icon={FlaskConical} title="Cupping QC" count={board.cuppings.length}>
          {board.cuppings.map((c: JejakCupping) => {
            const tone =
              c.score === null
                ? "border-border"
                : c.score >= 84
                  ? "border-emerald-300 bg-emerald-50/60"
                  : c.score < 80
                    ? "border-rose-200 bg-rose-50/60"
                    : "border-border";
            return (
              <NodeCard
                key={c.id}
                kind="cupping"
                id={c.id}
                dimmed={dim("cupping", c.id)}
                active={selected?.kind === "cupping" && selected.id === c.id}
                onClick={() => toggle("cupping", c.id)}
                visible
                href="/cupping"
                className={tone}
                title={c.label}
                sub={c.score !== null ? (c.score >= 84 ? "Sangat baik" : c.score < 80 ? "Perlu review" : "Baik") : undefined}
              />
            );
          })}
        </Column>

        {/* KOLOM 4 — OUTPUT */}
        <Column icon={Factory} title="Produksi & giling" count={board.outputs.length}>
          {board.outputs.map((o: JejakOutput) => (
            <NodeCard
              key={o.id}
              kind="output"
              id={o.id}
              dimmed={dim("output", o.id)}
              active={selected?.kind === "output" && selected.id === o.id}
              onClick={() => toggle("output", o.id)}
              visible
              href={o.kind === "PRODUKSI" ? `/produksi/batch/${o.id}` : "/grinding"}
              title={`${o.kind === "PRODUKSI" ? "PRD" : "GRD"} · ${o.code}`}
              sub={o.kind === "PRODUKSI" ? "kemasan jadi" : "giling"}
            />
          ))}
        </Column>
      </div>
    </div>
  );
}

function Column({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof Boxes;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0 rounded-card border border-border bg-surface p-3">
      <header className="mb-2.5 flex items-center justify-between px-1">
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-secondary">
          <Icon size={13} aria-hidden /> {title}
        </p>
        <span className="font-mono text-[10px] font-bold tabular-nums text-ink-tertiary">{count}</span>
      </header>
      <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto custom-scrollbar pr-0.5">
        {children}
      </div>
    </section>
  );
}

function NodeCard({
  kind,
  id,
  title,
  sub,
  footer,
  dimmed,
  active,
  visible,
  warn,
  href,
  className,
  onClick,
}: {
  kind: "lot" | "batch" | "cupping" | "output";
  id: string;
  title: string;
  sub?: string;
  footer?: React.ReactNode;
  dimmed: boolean;
  active: boolean;
  visible: boolean;
  warn?: boolean;
  href?: string;
  className?: string;
  onClick: () => void;
}) {
  if (!visible) return null;
  const inner = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px] font-bold text-foreground">{title}</span>
        {warn ? <span className="size-2 shrink-0 rounded-full bg-[var(--status-danger)]" aria-label="Belum selesai" /> : null}
      </span>
      {sub ? <span className="truncate text-[11px] leading-4 text-ink-secondary">{sub}</span> : null}
      {footer}
    </>
  );
  const cls = cn(
    "block w-full rounded-xl border p-3 text-left transition-all",
    dimmed ? "opacity-25 saturate-0" : "opacity-100",
    active ? "border-primary ring-2 ring-primary/30" : "",
    !active && !dimmed && "hover:border-primary/50",
    className,
  );
  if (href && !dimmed) {
    return (
      <Link
        href={href}
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
        className={cls}
        data-entity-kind={kind}
        data-entity-id={id}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} data-entity-kind={kind} data-entity-id={id}>
      {inner}
    </button>
  );
}
