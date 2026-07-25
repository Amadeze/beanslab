import React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description, className, ...props }: SectionHeaderProps) {
  return (
    <div className={cn("mb-5 flex flex-col gap-1.5 border-l-2 border-primary pl-3", className)} {...props}>
      <h2 className="text-lg font-black tracking-[-0.03em] text-[#081820]">{title}</h2>
      {description && <p className="text-sm font-medium text-[#5B696D]">{description}</p>}
    </div>
  );
}
