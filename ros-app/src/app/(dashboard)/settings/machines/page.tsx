import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { MachinesClient } from "../../master-data/machines/_components/MachinesClient";
import { SettingsNav } from "../_components/SettingsNav";

export default async function MachineSettingsPage() {
  const user = await requireRole("OWNER", "MANAGER");
  const machines = await prisma.machine.findMany({
    where: { tenantId: user.tenantId },
    select: {
      id: true,
      name: true,
      description: true,
      capacityKg: true,
      isActive: true,
      createdAt: true,
      _count: { select: { roastdStudios: true, artisanImports: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Mesin Roasting"
        eyebrow="Pengaturan"
        description="Kelola mesin dan kapasitas batch untuk operasi serta Artisan."
      />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1200px] p-4 md:p-6 lg:p-8">
          <MachinesClient
            machines={machines.map((machine) => ({
              ...machine,
              capacityKg: machine.capacityKg ? Number(machine.capacityKg) : null,
              createdAt: machine.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
