"use server";

import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const MachineSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  capacityKg: z.number().positive().optional(),
});

export type MachineActionResult =
  | { success: true }
  | { success: false; error: string };

export async function createMachine(data: unknown): Promise<MachineActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    const parsed = MachineSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
      };
    }

    await tenantPrisma.$transaction(async (tx) => {
      const machine = await tx.machine.create({
        data: {
          tenantId: user.tenantId,
          name: parsed.data.name,
          description: parsed.data.description,
          capacityKg: parsed.data.capacityKg,
        },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: "CREATE",
        entityType: "Machine",
        entityId: machine.id,
        metadata: { name: parsed.data.name },
      });
    });

    revalidatePath("/master-data/machines");
    revalidatePath("/settings/machines");
    return { success: true };
  } catch (err) {
    console.error("[createMachine]", err);
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { success: false, error: "Mesin dengan nama ini sudah ada." };
    }
    return { success: false, error: "Gagal membuat mesin." };
  }
}

export async function updateMachine(
  id: string,
  data: unknown,
): Promise<MachineActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    const parsed = MachineSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
      };
    }

    await tenantPrisma.$transaction(async (tx) => {
      await tx.machine.update({
        where: { id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          capacityKg: parsed.data.capacityKg,
        },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: "UPDATE",
        entityType: "Machine",
        entityId: id,
        metadata: { name: parsed.data.name },
      });
    });

    revalidatePath("/master-data/machines");
    revalidatePath("/settings/machines");
    return { success: true };
  } catch (err) {
    console.error("[updateMachine]", err);
    return { success: false, error: "Gagal mengupdate mesin." };
  }
}

export async function toggleMachineActive(
  id: string,
  isActive: boolean,
): Promise<MachineActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    await tenantPrisma.$transaction(async (tx) => {
      await tx.machine.update({
        where: { id },
        data: { isActive },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: isActive ? "ACTIVATE" : "DEACTIVATE",
        entityType: "Machine",
        entityId: id,
      });
    });

    revalidatePath("/master-data/machines");
    revalidatePath("/settings/machines");
    return { success: true };
  } catch (err) {
    console.error("[toggleMachineActive]", err);
    return { success: false, error: "Gagal mengubah status mesin." };
  }
}
