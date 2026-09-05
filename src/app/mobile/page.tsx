import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import { headers } from "next/headers";
import {
  FLAG_REQUEST_HEADER,
  isFlagEnabledFromSnapshot,
  parseFlagRequestHeader,
} from "@/lib/featureFlags";
import { notFound } from "next/navigation";
import { QUICK_ACTIONS } from "./mobileQuickActions";

export const dynamic = "force-dynamic";

export default async function MobileHomePage() {
  const flagHeader = (await headers()).get(FLAG_REQUEST_HEADER);
  const flags = parseFlagRequestHeader(flagHeader);
  if (!isFlagEnabledFromSnapshot(flags, "mobile-first")) {
    notFound();
  }
  const user = await requireCurrentUser();

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col gap-5 px-4 py-6">
      <header>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-copper">
          roastd.id · mobile
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold leading-tight tracking-[-0.04em] text-ink">
          {user.name?.split(" ")[0] ?? "Halo"}, mau kerjain apa?
        </h1>
        <p className="mt-1 text-xs text-ink-secondary">
          Top 5 aksi · satu ketukan dari sini.
        </p>
      </header>
      <ul className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <li key={action.label}>
              <Link
                href={action.href}
                className="flex h-28 flex-col justify-between rounded-card border border-border bg-card p-3 shadow-elevation-soft transition hover:border-copper hover:shadow-elevation-card"
              >
                <span className="grid size-9 place-items-center rounded-[9px] border border-copper/30 bg-copper-soft text-copper-strong">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-heading text-sm font-bold tracking-[-0.02em] text-ink">
                    {action.label}
                  </span>
                  <span className="block text-[11px] text-ink-secondary">{action.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto text-center text-[11px] text-ink-tertiary">
        Akses cepat dari sidebar untuk semua menu lain.
      </p>
    </main>
  );
}