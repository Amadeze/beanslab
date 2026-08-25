import { getDashboardData, getTodayData } from "./actions";
import { requireCurrentUser } from "@/lib/auth";
import { DashboardShell } from "./_components/DashboardShell";
import { TodayShell } from "./_components/TodayShell";
import { getCopilotInsights } from "./copilot-actions";

export const dynamic = "force-dynamic";


export default async function DashboardPage() {
  const user = await requireCurrentUser();

  if (user.role === "OPERATOR" || user.role === "CASHIER") {
    const data = await getTodayData();
    return <TodayShell data={data} />;
  }

  const [data, insights] = await Promise.all([
    getDashboardData(),
    getCopilotInsights(),
  ]);
  return <DashboardShell data={data} insights={insights} />;
}
