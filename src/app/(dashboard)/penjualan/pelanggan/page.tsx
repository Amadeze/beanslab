import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { MasterDataClient } from "@/app/(dashboard)/master-data/_components/MasterDataClient";
import { getCustomerDirectoryData } from "@/app/(dashboard)/master-data/actions";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [session, data] = await Promise.all([
    getIronSession<{ user?: SessionUser }>(await cookies(), SESSION_OPTIONS),
    getCustomerDirectoryData(),
  ]);

  return (
    <MasterDataClient
      data={data}
      userRole={session.user?.role || "CASHIER"}
      allowedTabs={["pelanggan"]}
      initialTab="pelanggan"
      title="Penjualan"
      description="Pelanggan, transaksi, dan riwayat hubungan komersial berada dalam satu konteks"
      workspace="sales"
    />
  );
}
