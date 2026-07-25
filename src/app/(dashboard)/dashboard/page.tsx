import { getDashboardData } from "./actions";
import { getTenantAccessRecord, requireCurrentUser } from "@/lib/auth";
import { DashboardShell } from "./_components/DashboardShell";

export const dynamic = "force-dynamic";


export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const tenant = await getTenantAccessRecord(user.tenantId);
  const data = await getDashboardData();
  return (
    <>
      <DashboardShell data={data} />
    </>
  );
}
