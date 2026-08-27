import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

/**
 * @deprecated Gunakan `<Card variant="glass" padding="…">` — satu primitif
 * permukaan. Wrapper ini tinggal delegasi agar panggilan lama tetap jalan;
 * dihapus setelah sweep migrasi selesai.
 */
export function GlassPanel({ className, padding = "md", hover, children, ...props }: GlassPanelProps) {
  return (
    <Card
      variant="glass"
      padding={padding}
      className={cn(
        hover &&
          "transition-all hover:bg-[var(--glass-bg-hover)] hover:border-[var(--glass-border-hover)] hover:shadow-[var(--glass-shadow-lg)] motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  );
}
