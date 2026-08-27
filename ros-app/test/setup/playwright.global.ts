import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { assertSafeTestDatabase } from "./assert-safe-test-db";

// Playwright global setup always runs before E2E. E2E touches a database via
// the running Next server, so refuse to start the suite against production.
export default async function e2eDbGuard(): Promise<void> {
  assertSafeTestDatabase();
  if (!process.env.DATABASE_URL) return;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const owner = await prisma.user.findFirst({
      where: { isActive: true, role: "OWNER", tenant: { isActive: true } },
      orderBy: { createdAt: "asc" },
      select: { tenantId: true },
    });
    if (!owner) {
      throw new Error(
        "Release E2E requires a migrated and seeded local database with an active OWNER tenant.",
      );
    }

    await prisma.tenant.update({
      where: { id: owner.tenantId },
      data: { setupCompletedAt: new Date() },
    });
    const manualPaymentMethodCount = await prisma.tenantPaymentMethod.count({
      where: { tenantId: owner.tenantId, provider: "MANUAL", isActive: true },
    });
    if (manualPaymentMethodCount === 0) {
      await prisma.tenantPaymentMethod.create({
        data: {
          tenantId: owner.tenantId,
          provider: "MANUAL",
          method: "TRANSFER",
          label: "Rekening E2E",
          bankName: "Bank E2E",
          accountNumber: "0000000000",
          accountHolder: "E2E Roastery",
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
