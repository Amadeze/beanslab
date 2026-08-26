"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Radar, FlaskConical, Beaker, Database, ScrollText, Receipt, Sparkles } from "lucide-react";
import { APP_NAV_SECTIONS, canAccessNavigation } from "./Sidebar";
import type { PlanTier } from "@/lib/plans";
import { cn } from "@/lib/utils";

type RouteEntry = { label: string; href: string; group: string; Icon: React.ElementType };

const HIDDEN_ROUTES: RouteEntry[] = [
  { label: "Cupping & QC", href: "/cupping", group: "Operasional", Icon: Radar },
  { label: "Grinding", href: "/grinding", group: "Operasional", Icon: Beaker },
  { label: "Eksperimen", href: "/eksperimen", group: "Operasional", Icon: FlaskConical },
  { label: "Master Data", href: "/master-data", group: "Komersial", Icon: Database },
  { label: "Tanya Roastd", href: "/ai-insights", group: "Uang & Kinerja", Icon: Sparkles },
  { label: "Audit & Log", href: "/audit", group: "Kelola", Icon: ScrollText },
  { label: "Tagihan & Langganan", href: "/billing", group: "Kelola", Icon: Receipt },
];

export function CommandPalette({
  userRole,
  subscriptionTier,
}: {
  userRole: string;
  subscriptionTier: PlanTier;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const routes = useMemo<RouteEntry[]>(() => {
    const fromNav = APP_NAV_SECTIONS.flatMap((section) =>
      section.items
        .filter((item) => canAccessNavigation(item.href, userRole, subscriptionTier))
        .map((item) => ({
          label: item.label,
          href: item.href,
          group: section.label,
          Icon: item.icon,
        })),
    );
    const hrefs = new Set(fromNav.map((r) => r.href));
    const extra = HIDDEN_ROUTES.filter(
      (r) => !hrefs.has(r.href) && canAccessNavigation(r.href, userRole, subscriptionTier),
    );
    return [...fromNav, ...extra];
  }, [userRole, subscriptionTier]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.href.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q),
    );
  }, [query, routes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) go(results[active].href);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Perintah cepat"
    >
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-[16px] border border-white/12 bg-[var(--chrome-panel)] shadow-[0_40px_120px_rgba(0,0,0,.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search size={16} className="shrink-0 text-[#E9A17F]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Cari halaman atau perintah…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
          />
          <kbd className="rounded-[6px] border border-white/12 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-white/45">ESC</kbd>
        </div>
        <ul className="custom-scrollbar max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-white/40">Tidak ada hasil</li>
          ) : (
            results.map((r, i) => {
              const Icon = r.Icon;
              return (
                <li key={r.href}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition",
                      i === active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04] text-[#E9A17F]">
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{r.label}</span>
                      <span className="block truncate font-mono text-[10px] text-white/35">{r.href}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">{r.group}</span>
                    {i === active ? <CornerDownLeft size={13} className="shrink-0 text-white/45" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
