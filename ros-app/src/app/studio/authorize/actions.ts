"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { hashStudioVerificationCode } from "@/lib/artisan/connector-auth";
import { recordAudit } from "@/lib/audit";

function errorUrl(code: string, message: string): string {
  return `/studio/authorize?code=${encodeURIComponent(code)}&error=${encodeURIComponent(message)}`;
}

export async function approveStudioDevice(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const machineId = String(formData.get("machineId") ?? "").trim();
  let destination = errorUrl(code, "Izin Studio tidak dapat diproses.");

  try {
    const user = await requireRole("OWNER");
    if (code.length < 24 || code.length > 128 || !machineId) {
      destination = errorUrl(code, "Pilih mesin untuk melanjutkan.");
    } else {
      const authorization = await prisma.studioDeviceAuthorization.findUnique({
        where: { verificationCodeHash: hashStudioVerificationCode(code) },
        select: { id: true, status: true, expiresAt: true, computerName: true },
      });
      const machine = await prisma.machine.findFirst({
        where: { id: machineId, tenantId: user.tenantId, isActive: true },
        select: { id: true, name: true },
      });

      if (!authorization || authorization.status !== "PENDING") {
        destination = errorUrl(code, "Permintaan login sudah tidak tersedia.");
      } else if (authorization.expiresAt <= new Date()) {
        await prisma.studioDeviceAuthorization.updateMany({
          where: { id: authorization.id, status: "PENDING" },
          data: { status: "DENIED" },
        });
        destination = errorUrl(code, "Waktu login habis. Mulai ulang dari Studio.");
      } else if (!machine) {
        destination = errorUrl(code, "Mesin tidak ditemukan atau tidak aktif.");
      } else {
        const approved = await prisma.$transaction(async (transaction) => {
          const result = await transaction.studioDeviceAuthorization.updateMany({
            where: { id: authorization.id, status: "PENDING", expiresAt: { gt: new Date() } },
            data: {
              status: "APPROVED",
              tenantId: user.tenantId,
              machineId: machine.id,
              approvedByUserId: user.id,
              approvedAt: new Date(),
            },
          });
          if (result.count !== 1) return false;

          await recordAudit(transaction, {
            tenantId: user.tenantId,
            userId: user.id,
            action: "APPROVE",
            entityType: "StudioDeviceAuthorization",
            entityId: authorization.id,
            metadata: {
              machineId: machine.id,
              machineName: machine.name,
              computerName: authorization.computerName,
            },
          });
          return true;
        });

        destination = approved
          ? `/studio/authorize/success?machine=${encodeURIComponent(machine.name)}`
          : errorUrl(code, "Permintaan login sudah diproses.");
      }
    }
  } catch (error) {
    destination = errorUrl(
      code,
      error instanceof Error && error.message === "FORBIDDEN"
        ? "Hanya owner yang dapat menghubungkan Studio."
        : "Izin Studio tidak dapat diproses.",
    );
  }

  redirect(destination);
}
