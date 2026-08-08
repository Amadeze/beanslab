"use server";

import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const WarehouseSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().max(500).optional(),
  capacity: z.number().positive().optional(),
});

export type WarehouseActionResult =
  | { success: true }
  | { success: false; error: string };

export async function createWarehouse(data: unknown): Promise<WarehouseActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    const parsed = WarehouseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
      };
    }

    await tenantPrisma.$transaction(async (tx) => {
      await tx.warehouse.create({
        data: {
          tenantId: user.tenantId,
          code: parsed.data.code,
          name: parsed.data.name,
          address: parsed.data.address,
        },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: "CREATE",
        entityType: "Warehouse",
        entityId: "pending",
        metadata: { code: parsed.data.code, name: parsed.data.name },
      });
    });

    revalidatePath("/gudang");
    return { success: true };
  } catch (err) {
    console.error("[createWarehouse]", err);
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { success: false, error: "Kode gudang sudah dipakai." };
    }
    return { success: false, error: "Gagal membuat gudang." };
  }
}

export async function updateWarehouse(
  id: string,
  data: unknown,
): Promise<WarehouseActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    const parsed = WarehouseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
      };
    }

    await tenantPrisma.$transaction(async (tx) => {
      await tx.warehouse.update({
        where: { id },
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          address: parsed.data.address,
        },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: "UPDATE",
        entityType: "Warehouse",
        entityId: id,
        metadata: { code: parsed.data.code, name: parsed.data.name },
      });
    });

    revalidatePath("/gudang");
    return { success: true };
  } catch (err) {
    console.error("[updateWarehouse]", err);
    return { success: false, error: "Gagal memperbarui gudang." };
  }
}

export async function toggleWarehouseActive(
  id: string,
  isActive: boolean,
): Promise<WarehouseActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    await tenantPrisma.$transaction(async (tx) => {
      await tx.warehouse.update({
        where: { id },
        data: { isActive },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: isActive ? "ACTIVATE" : "DEACTIVATE",
        entityType: "Warehouse",
        entityId: id,
      });
    });

    revalidatePath("/gudang");
    return { success: true };
  } catch (err) {
    console.error("[toggleWarehouseActive]", err);
    return { success: false, error: "Gagal mengubah status gudang." };
  }
}

export async function listWarehousesAction() {
  const user = await requireRole("OWNER", "MANAGER");
  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId: user.tenantId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return warehouses.map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    address: w.address,
    isDefault: w.isDefault,
    createdAt: w.createdAt.toISOString(),
  }));
}

export interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  _count: { locations: number };
}
