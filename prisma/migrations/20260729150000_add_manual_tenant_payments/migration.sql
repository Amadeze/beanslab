CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'MIDTRANS', 'XENDIT');
CREATE TYPE "PaymentSubmissionStatus" AS ENUM (
    'AWAITING_PROOF',
    'AWAITING_VERIFICATION',
    'VERIFIED',
    'REJECTED',
    'EXPIRED'
);

CREATE TABLE "tenant_payment_methods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "method" "PaymentMethod" NOT NULL,
    "label" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountHolder" TEXT,
    "qrisImageUrl" TEXT,
    "instructions" TEXT,
    "requireProof" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_submissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "paymentId" TEXT,
    "publicToken" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'AWAITING_PROOF',
    "amount" DECIMAL(14,2) NOT NULL,
    "payerName" TEXT,
    "reference" TEXT,
    "destination" JSONB,
    "proofObjectPath" TEXT,
    "proofMimeType" TEXT,
    "proofFilename" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tenant_payment_methods_tenantId_isActive_displayOrder_idx"
    ON "tenant_payment_methods"("tenantId", "isActive", "displayOrder");
CREATE UNIQUE INDEX "payment_submissions_paymentId_key" ON "payment_submissions"("paymentId");
CREATE UNIQUE INDEX "payment_submissions_publicToken_key" ON "payment_submissions"("publicToken");
CREATE INDEX "payment_submissions_tenantId_status_submittedAt_idx"
    ON "payment_submissions"("tenantId", "status", "submittedAt");
CREATE INDEX "payment_submissions_tenantId_invoiceId_idx"
    ON "payment_submissions"("tenantId", "invoiceId");
CREATE INDEX "payment_submissions_status_expiresAt_idx"
    ON "payment_submissions"("status", "expiresAt");

ALTER TABLE "tenant_payment_methods" ADD CONSTRAINT "tenant_payment_methods_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "tenant_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_payment_methods" ADD CONSTRAINT "tenant_payment_methods_manual_shape_check" CHECK (
    ("method" = 'TRANSFER' AND "bankName" IS NOT NULL AND "accountNumber" IS NOT NULL AND "accountHolder" IS NOT NULL)
    OR ("method" = 'QRIS' AND "qrisImageUrl" IS NOT NULL)
    OR ("method" IN ('CASH', 'CREDIT'))
);
