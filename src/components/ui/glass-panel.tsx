import React from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export function GlassPanel({ className, padding = "md", hover, children, ...props }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[14px] shadow-[var(--glass-shadow)]",
        padding === "sm" && "p-3",
        padding === "md" && "p-5",
        padding === "lg" && "p-8",
        hover && "hover:bg-[var(--glass-bg-hover)] hover:border-[var(--glass-border-hover)] hover:shadow-[var(--glass-shadow-lg)] transition-all",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
