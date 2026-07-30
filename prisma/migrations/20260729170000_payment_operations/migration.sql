CREATE TYPE "PaymentNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "tenants"
    ADD COLUMN "xenditSubAccountId" TEXT,
    ADD COLUMN "xenditEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "payment_submissions"
    ADD COLUMN "declaredAmount" DECIMAL(14,2),
    ADD COLUMN "reviewedAmount" DECIMAL(14,2),
    ADD COLUMN "proofSha256" TEXT,
    ADD COLUMN "suspectedDuplicateOfId" TEXT,
    ADD COLUMN "submissionAttempt" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "payment_notification_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentSubmissionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "PaymentNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_submissions_tenantId_reference_submittedAt_idx"
    ON "payment_submissions"("tenantId", "reference", "submittedAt");
CREATE INDEX "payment_submissions_tenantId_proofSha256_submittedAt_idx"
    ON "payment_submissions"("tenantId", "proofSha256", "submittedAt");
CREATE UNIQUE INDEX "payment_notification_deliveries_paymentSubmissionId_event_channel_recipient_attempt_key"
    ON "payment_notification_deliveries"("paymentSubmissionId", "event", "channel", "recipient", "attempt");
CREATE INDEX "payment_notification_deliveries_tenantId_status_createdAt_idx"
    ON "payment_notification_deliveries"("tenantId", "status", "createdAt");
CREATE INDEX "payment_notification_deliveries_paymentSubmissionId_idx"
    ON "payment_notification_deliveries"("paymentSubmissionId");

ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_suspectedDuplicateOfId_fkey"
    FOREIGN KEY ("suspectedDuplicateOfId") REFERENCES "payment_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_notification_deliveries" ADD CONSTRAINT "payment_notification_deliveries_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_notification_deliveries" ADD CONSTRAINT "payment_notification_deliveries_paymentSubmissionId_fkey"
    FOREIGN KEY ("paymentSubmissionId") REFERENCES "payment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
