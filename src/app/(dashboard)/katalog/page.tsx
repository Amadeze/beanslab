import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { MasterDataClient } from "@/app/(dashboard)/master-data/_components/MasterDataClient";
import { getMasterData } from "@/app/(dashboard)/master-data/actions";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [session, data, params] = await Promise.all([
    getIronSession<{ user?: SessionUser }>(await cookies(), SESSION_OPTIONS),
    getMasterData(),
    searchParams,
  ]);
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  const tab = requestedTab === "supply"
    ? "supply"
    : requestedTab === "penawaran"
      ? "penawaran"
      : "produk";

  return (
    <MasterDataClient
      data={data}
      userRole={session.user?.role || "OWNER"}
      allowedTabs={["produk", "supply", "penawaran"]}
      initialTab={tab}
      title="Katalog"
      description="Bahan baku, roasted bean, produk jual, penawaran kopi, resep, harga, dan persediaan non-kopi"
    />
  );
}
