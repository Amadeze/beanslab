import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { MasterDataClient } from "@/app/(dashboard)/master-data/_components/MasterDataClient";
import { getMasterData } from "@/app/(dashboard)/master-data/actions";
import { requireRole } from "@/lib/auth";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  await requireRole("OWNER");
  const [session, data] = await Promise.all([
    getIronSession<{ user?: SessionUser }>(await cookies(), SESSION_OPTIONS),
    getMasterData(),
  ]);

  return (
    <MasterDataClient
      data={data}
      userRole={session.user?.role || "OWNER"}
      allowedTabs={["pengguna"]}
      initialTab="pengguna"
      title="Anggota Tim"
      description="Kelola siapa yang dapat bekerja di workspace roastery ini"
      workspace="settings"
    />
  );
}
