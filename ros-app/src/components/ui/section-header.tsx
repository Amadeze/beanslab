import React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description, className, ...props }: SectionHeaderProps) {
  return (
    <div className={cn("mb-5 flex flex-col gap-1.5 border-l-2 border-primary pl-3", className)} {...props}>
      <h2 className="font-heading text-lg font-bold tracking-[-0.035em] text-foreground">{title}</h2>
      {description && <p className="max-w-3xl text-sm font-medium leading-5 text-muted-foreground">{description}</p>}
    </div>
  );
}
