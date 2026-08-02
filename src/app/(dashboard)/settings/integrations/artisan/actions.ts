"use server";

import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  generatePairingCode,
  hashPairingCode,
} from "@/lib/artisan/connector-auth";

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

export type PairingActionResult =
  | { success: true; code: string; expiresAt: string; machineName: string }
  | { success: false; error: string };

export async function createPairingCode(
  machineId: string,
): Promise<PairingActionResult> {
  try {
    const user = await requireRole("OWNER");
    const tenantPrisma = await requireTenantPrisma();

    const machine = await tenantPrisma.machine.findFirst({
      where: { id: machineId, isActive: true, tenantId: user.tenantId },
      select: { id: true, name: true },
    });
    if (!machine) {
      return { success: false, error: "Mesin tidak ditemukan atau tidak aktif." };
    }

    const code = generatePairingCode();
    const codeHash = hashPairingCode(code);
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);

    await tenantPrisma.$transaction(async (tx) => {
      const pairingCode = await tx.artisanPairingCode.create({
        data: {
          tenantId: user.tenantId,
          machineId,
          createdByUserId: user.id,
          codeHash,
          expiresAt,
        },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: "CREATE",
        entityType: "ArtisanPairingCode",
        entityId: pairingCode.id,
        metadata: { machineId, machineName: machine.name },
      });
    });

    return {
      success: true,
      code,
      expiresAt: expiresAt.toISOString(),
      machineName: machine.name,
    };
  } catch (err) {
    console.error("[createPairingCode]", err);
    return { success: false, error: "Gagal membuat kode pairing." };
  }
}

export type RevokeActionResult =
  | { success: true }
  | { success: false; error: string };

export async function revokeConnector(
  connectorId: string,
): Promise<RevokeActionResult> {
  try {
    const user = await requireRole("OWNER");
    const tenantPrisma = await requireTenantPrisma();

    const connector = await tenantPrisma.roastdStudio.findFirst({
      where: { id: connectorId, tenantId: user.tenantId },
      select: { id: true, computerName: true, revokedAt: true },
    });

    if (!connector) {
      return { success: false, error: "Connector tidak ditemukan." };
    }
    if (connector.revokedAt) {
      return { success: false, error: "Connector sudah dicabut." };
    }

    await tenantPrisma.$transaction(async (tx) => {
      await tx.roastdStudio.update({
        where: { id: connectorId },
        data: { status: "REVOKED", revokedAt: new Date() },
      });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: "REVOKE",
        entityType: "RoastdStudio",
        entityId: connectorId,
        metadata: { computerName: connector.computerName },
      });
    });

    revalidatePath("/settings/integrations/artisan");
    return { success: true };
  } catch (err) {
    console.error("[revokeConnector]", err);
    return { success: false, error: "Gagal mencabut connector." };
  }
}
