import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";
import { Card } from "./card";

/**
 * Widget — sel bento untuk Hari Ini. Satu ide per kartu:
 * header kecil (eyebrow + judul + tautan aksi) di atas konten bebas.
 */
export function Widget({
  label,
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  /** Eyebrow mono kecil, mis. "Hari ini". */
  label?: string;
  title: string;
  /** Tautan/aksi kecil di kanan header. */
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5 md:px-5">
        <div className="min-w-0">
          {label ? <Eyebrow tone="muted">{label}</Eyebrow> : null}
          <h2 className={cn("truncate font-heading text-sm font-bold tracking-[-0.02em] text-foreground", label && "mt-0.5")}>
            {title}
          </h2>
        </div>
        {action ? (
          <Link
            href={action.href}
            className="shrink-0 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </Card>
  );
}
