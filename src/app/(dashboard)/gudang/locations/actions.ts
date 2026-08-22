"use server";

import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import {
  isSystemLocation,
  SYSTEM_LOCATION_CODE_ERROR,
  SYSTEM_LOCATION_CODE_PREFIX,
  SYSTEM_LOCATION_ERROR,
} from "@/lib/system-location";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const LocationSchema = z.object({
  warehouseId: z.string().min(1),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  zone: z.string().trim().max(50).optional(),
  capacity: z.number().positive().optional(),
});

export type LocationActionResult =
  | { success: true }
  | { success: false; error: string };

export async function createLocation(data: unknown): Promise<LocationActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    const parsed = LocationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
      };
    }

    if (parsed.data.code.startsWith(SYSTEM_LOCATION_CODE_PREFIX)) {
      return { success: false, error: SYSTEM_LOCATION_CODE_ERROR };
    }

    await tenantPrisma.$transaction(async (tx) => {
      await tx.location.create({
        data: {
          tenantId: user.tenantId,
          warehouseId: parsed.data.warehouseId,
          code: parsed.data.code,
          name: parsed.data.name,
          zone: parsed.data.zone,
          capacity: parsed.data.capacity,
        },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: "CREATE",
        entityType: "Location",
        entityId: "pending",
        metadata: { code: parsed.data.code, name: parsed.data.name },
      });
    });

    revalidatePath("/gudang");
    return { success: true };
  } catch (err) {
    console.error("[createLocation]", err);
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { success: false, error: "Kode lokasi sudah dipakai di gudang ini." };
    }
    if (err instanceof Error && err.message.includes("Foreign")) {
      return { success: false, error: "Gudang tidak ditemukan." };
    }
    return { success: false, error: "Gagal membuat lokasi." };
  }
}

export async function updateLocation(
  id: string,
  data: unknown,
): Promise<LocationActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    const parsed = LocationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
      };
    }

    const existing = await tenantPrisma.location.findUnique({
      where: { id },
      select: { tenantId: true, isSystem: true, code: true },
    });
    if (!existing || existing.tenantId !== user.tenantId) {
      return { success: false, error: "Lokasi tidak ditemukan." };
    }
    if (isSystemLocation(existing)) {
      return { success: false, error: SYSTEM_LOCATION_ERROR };
    }
    if (parsed.data.code.startsWith(SYSTEM_LOCATION_CODE_PREFIX)) {
      return { success: false, error: SYSTEM_LOCATION_CODE_ERROR };
    }

    await tenantPrisma.$transaction(async (tx) => {
      await tx.location.update({
        where: { id },
        data: {
          warehouseId: parsed.data.warehouseId,
          code: parsed.data.code,
          name: parsed.data.name,
          zone: parsed.data.zone,
          capacity: parsed.data.capacity,
        },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: "UPDATE",
        entityType: "Location",
        entityId: id,
        metadata: { code: parsed.data.code, name: parsed.data.name },
      });
    });

    revalidatePath("/gudang");
    return { success: true };
  } catch (err) {
    console.error("[updateLocation]", err);
    return { success: false, error: "Gagal memperbarui lokasi." };
  }
}

export async function toggleLocationActive(
  id: string,
  isActive: boolean,
): Promise<LocationActionResult> {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    const existing = await tenantPrisma.location.findUnique({
      where: { id },
      select: { tenantId: true, isSystem: true },
    });
    if (!existing || existing.tenantId !== user.tenantId) {
      return { success: false, error: "Lokasi tidak ditemukan." };
    }
    if (isSystemLocation(existing)) {
      return { success: false, error: SYSTEM_LOCATION_ERROR };
    }

    await tenantPrisma.$transaction(async (tx) => {
      await tx.location.update({
        where: { id },
        data: { isActive },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: isActive ? "ACTIVATE" : "DEACTIVATE",
        entityType: "Location",
        entityId: id,
      });
    });

    revalidatePath("/gudang");
    return { success: true };
  } catch (err) {
    console.error("[toggleLocationActive]", err);
    return { success: false, error: "Gagal mengubah status lokasi." };
  }
}

export interface LocationRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  code: string;
  name: string;
  zone: string | null;
  capacity: number | null;
  isActive: boolean;
  isDefault: boolean;
  isSystem: boolean;
  systemPurpose: string | null;
  createdAt: string;
}
