import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const webhookRetentionDate = new Date();
  webhookRetentionDate.setDate(webhookRetentionDate.getDate() - 90);
  const reminderRetentionDate = new Date();
  reminderRetentionDate.setDate(reminderRetentionDate.getDate() - 365);

  const [rateLimits, webhookEvents, passwordResetTokens, reminderDeliveries] = await prisma.$transaction([
    prisma.rateLimitBucket.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    }),
    prisma.webhookEvent.deleteMany({
      where: {
        receivedAt: { lt: webhookRetentionDate },
        status: { in: ["PROCESSED", "IGNORED"] },
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    }),
    prisma.reminderDelivery.deleteMany({
      where: {
        reminderDate: { lt: reminderRetentionDate },
        status: "SENT",
      },
    }),
  ]);

  console.log(
    JSON.stringify({
      deletedRateLimitBuckets: rateLimits.count,
      deletedWebhookEvents: webhookEvents.count,
      deletedPasswordResetTokens: passwordResetTokens.count,
      deletedReminderDeliveries: reminderDeliveries.count,
    }),
  );
} finally {
  await prisma.$disconnect();
}
