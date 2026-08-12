import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { MachinesClient } from "../../master-data/machines/_components/MachinesClient";

export default async function RoastingMachinesPage() {
  const user = await requireRole("OWNER", "MANAGER", "OPERATOR");
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
        eyebrow="Roasting"
        description="Daftar mesin roasting yang terhubung dengan operasi Anda."
      />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1200px] p-4 md:p-6 lg:p-8">
          <MachinesClient
            readonly={true}
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
