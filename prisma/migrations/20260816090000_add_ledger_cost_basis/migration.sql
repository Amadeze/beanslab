-- AlterTable
ALTER TABLE "inventory_ledger" ADD COLUMN     "incomingPrice" DECIMAL(12,2),
ADD COLUMN     "reversalOfLedgerId" TEXT;