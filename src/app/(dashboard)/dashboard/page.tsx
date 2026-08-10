import { getDashboardData, getTodayData } from "./actions";
import { requireCurrentUser } from "@/lib/auth";
import { DashboardShell } from "./_components/DashboardShell";
import { TodayShell } from "./_components/TodayShell";

export const dynamic = "force-dynamic";


export default async function DashboardPage() {
  const user = await requireCurrentUser();

  if (user.role === "OPERATOR" || user.role === "CASHIER") {
    const data = await getTodayData();
    return <TodayShell data={data} />;
  }

  const data = await getDashboardData();
  return <DashboardShell data={data} />;
}
