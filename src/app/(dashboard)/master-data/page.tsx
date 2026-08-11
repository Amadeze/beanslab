import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";

import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";

export default async function LegacyMasterDataPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [session, params] = await Promise.all([
    getIronSession<{ user?: SessionUser }>(await cookies(), SESSION_OPTIONS),
    searchParams,
  ]);
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  if (session.user?.role === "CASHIER" || tab === "pelanggan") {
    redirect("/penjualan/pelanggan");
  }
  if (tab === "supplier") {
    redirect("/inventory/suppliers");
  }
  if (tab === "pengguna") {
    redirect("/settings/team");
  }
  redirect(
    tab === "kemasan" ? "/katalog?tab=supply"
    : tab === "penawaran" ? "/katalog?tab=penawaran"
    : "/katalog",
  );
}
