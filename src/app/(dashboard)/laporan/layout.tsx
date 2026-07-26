import { requireTenantPrisma } from "@/lib/auth";

export default async function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantPrisma();
  return <>{children}</>;
}
