-- SCA cupping sessions and one score per category per session.
CREATE TYPE "CuppingCategory" AS ENUM (
    'FRAGRANCE', 'AROMA', 'FLAVOR', 'AFTERTASTE', 'ACIDITY', 'BODY',
    'BALANCE', 'UNIFORMITY', 'CLEAN_CUP', 'SWEETNESS', 'OVERALL'
);

CREATE TABLE "cupping_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT,
    "productId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "evaluatorName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cupping_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cupping_scores" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "category" "CuppingCategory" NOT NULL,
    "score" DECIMAL(4,2) NOT NULL,
    "maxScore" DECIMAL(4,2) NOT NULL DEFAULT 10,
    "notes" TEXT,
    CONSTRAINT "cupping_scores_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cupping_scores_range_check" CHECK (
        "score" >= 0 AND "maxScore" > 0 AND "score" <= "maxScore"
    )
);

CREATE INDEX "cupping_sessions_tenantId_idx" ON "cupping_sessions"("tenantId");
CREATE INDEX "cupping_sessions_batchId_idx" ON "cupping_sessions"("batchId");
CREATE INDEX "cupping_sessions_productId_idx" ON "cupping_sessions"("productId");
CREATE INDEX "cupping_sessions_tenantId_date_idx" ON "cupping_sessions"("tenantId", "date");
CREATE INDEX "cupping_scores_sessionId_idx" ON "cupping_scores"("sessionId");
CREATE INDEX "cupping_scores_category_idx" ON "cupping_scores"("category");
CREATE UNIQUE INDEX "cupping_scores_sessionId_category_key" ON "cupping_scores"("sessionId", "category");

ALTER TABLE "cupping_sessions" ADD CONSTRAINT "cupping_sessions_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "parent_roasting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cupping_sessions" ADD CONSTRAINT "cupping_sessions_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cupping_sessions" ADD CONSTRAINT "cupping_sessions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cupping_scores" ADD CONSTRAINT "cupping_scores_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "cupping_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
