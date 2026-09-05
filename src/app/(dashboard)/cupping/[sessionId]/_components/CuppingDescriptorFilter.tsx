"use client";

import Link from "next/link";
import { X } from "lucide-react";

interface DescriptorEntry {
  keyword: string;
  count: number;
}

interface CuppingDescriptorFilterProps {
  descriptors: DescriptorEntry[];
  activeDescriptor: string | null;
  baseHref: string;
}

export function CuppingDescriptorFilter({
  descriptors,
  activeDescriptor,
  baseHref,
}: CuppingDescriptorFilterProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Link
        href={baseHref}
        className={`inline-flex h-7 items-center gap-1 rounded-pill border px-3 text-xs font-bold transition ${
          activeDescriptor === null
            ? "border-copper bg-copper text-white"
            : "border-border bg-card text-ink-secondary hover:border-copper hover:text-copper"
        }`}
        aria-pressed={activeDescriptor === null}
      >
        Semua
      </Link>
      {descriptors.map((descriptor) => {
        const isActive = activeDescriptor === descriptor.keyword;
        const target = isActive ? baseHref : `${baseHref}?descriptor=${encodeURIComponent(descriptor.keyword)}`;
        return (
          <Link
            key={descriptor.keyword}
            href={target}
            className={`inline-flex h-7 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium transition ${
              isActive
                ? "border-copper bg-copper text-white"
                : "border-border bg-card text-ink-secondary hover:border-copper hover:text-copper"
            }`}
            aria-pressed={isActive}
          >
            <span>{descriptor.keyword}</span>
            <span
              className={`rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-surface-sunken text-ink-tertiary"
              }`}
            >
              {descriptor.count}
            </span>
            {isActive ? <X className="size-3" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </div>
  );
}