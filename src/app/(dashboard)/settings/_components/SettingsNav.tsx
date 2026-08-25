"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getVisibleSettingsNavigation } from "./settings-navigation";

export function SettingsNav({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const visibleItems = getVisibleSettingsNavigation(userRole);

  return (
    <nav className="overflow-x-auto border-b border-border bg-card" aria-label="Navigasi pengaturan">
      <div className="mx-auto flex w-max min-w-full max-w-[1600px] gap-1 px-4 py-2 md:px-6 lg:px-8">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/settings"
            ? pathname === "/settings"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-instrument",
                active ? "bg-ink text-card" : "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
              )}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
