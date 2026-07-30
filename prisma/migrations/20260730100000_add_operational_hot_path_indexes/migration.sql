-- Fulfillment boards filter by tenant + status and sort oldest first.
CREATE INDEX "invoices_tenantId_fulfillmentStatus_issuedAt_idx"
  ON "invoices"("tenantId", "fulfillmentStatus", "issuedAt");

-- Invoice details, stock posting, returns, and reports repeatedly resolve items
-- from one or more invoice IDs. PostgreSQL does not index foreign keys itself.
CREATE INDEX "invoice_items_invoiceId_idx"
  ON "invoice_items"("invoiceId");
