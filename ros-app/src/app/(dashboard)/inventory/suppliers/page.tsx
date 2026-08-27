import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { MasterDataClient } from "@/app/(dashboard)/master-data/_components/MasterDataClient";
import { getMasterData } from "@/app/(dashboard)/master-data/actions";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const [session, data] = await Promise.all([
    getIronSession<{ user?: SessionUser }>(await cookies(), SESSION_OPTIONS),
    getMasterData(),
  ]);

  return (
    <MasterDataClient
      data={data}
      userRole={session.user?.role || "OWNER"}
      allowedTabs={["supplier"]}
      initialTab="supplier"
      title="Pasokan"
      description="Supplier adalah bagian dari alur pembelian, bukan data sistem terpisah"
      workspace="supply"
    />
  );
}
