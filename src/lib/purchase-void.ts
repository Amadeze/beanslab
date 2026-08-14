import { getCurrentDate } from "@/lib/date-utils";
import { appendLedger, recomputeProductCostInTx, type LedgerEntryData } from "@/lib/stock";
import { postVoidReversal } from "@/lib/posting";
import { recordAudit } from "@/lib/audit";

// Flexible type: works with both base PrismaClient and tenant-scoped extended
// client (mengikuti konvensi stock.ts / audit.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransactionClient = any;

/**
 * Void purchase (GB / Packaging legacy / SUPPLY) dengan aturan existing:
 *   • reversal hanya terhadap entry sumber (refId purchase, entryType IN);
 *   • ditolak bila lot sumber sudah dipakai transaksi turunan;
 *   • tidak menghasilkan double reversal (status VOID dicek ulang dalam tx);
 *   • cache dan ledger kembali konsisten (reversal via appendLedger).
 */
export async function voidPurchaseCore(
  prisma: TransactionClient,
  tenantId: string,
  userId: string,
  purchaseId: string,
  reason: string,
): Promise<void> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("Alasan void wajib diisi.");

  await prisma.$transaction(
    async (tx: TransactionClient) => {
      const purchase = await tx.purchase.findUnique({ where: { id: purchaseId } });
      if (!purchase) throw new Error("Pembelian tidak ditemukan.");
      if (purchase.status === "VOID") throw new Error("Pembelian sudah di-void.");
      if (purchase.status !== "COMPLETED") {
        throw new Error("Hanya pembelian selesai yang dapat di-void.");
      }
      const activePayments = await tx.supplierPayment.count({
        where: { purchaseId: purchase.id, voidAt: null },
      });
      if (activePayments > 0) {
        throw new Error("Void semua pembayaran supplier pada pembelian ini terlebih dahulu.");
      }

      const sourceEntries = await tx.inventoryLedger.findMany({
        where: {
          refId: purchase.id,
          refType: { in: ["PURCHASE_GB", "PURCHASE_PKG", "SUPPLY_PURCHASE_IN"] },
          entryType: "IN",
        },
      });
      if (sourceEntries.length !== 1) {
        throw new Error("Ledger pembelian tidak lengkap; void dibatalkan.");
      }

      const source = sourceEntries[0];
      if (source.lotId) {
        const downstreamCount = await tx.inventoryLedger.count({
          where: {
            lotId: source.lotId,
            entryType: "OUT",
            refType: { not: "VOID_REVERSAL" },
          },
        });
        if (downstreamCount > 0) {
          throw new Error("Lot pembelian sudah dipakai. Batalkan transaksi turunannya terlebih dahulu.");
        }
      }

      const data: LedgerEntryData = {
        tenantId,
        entryType: "OUT",
        refType: "VOID_REVERSAL",
        refId: purchase.id,
        reversalOfLedgerId: source.id,
        lotId: source.lotId,
        lotNumber: source.lotNumber,
        expiryDate: source.expiryDate,
        notes: `VOID pembelian: ${purchase.code}`,
        createdById: userId,
      };
      if (source.supplyItemId) {
        data.supplyItemId = source.supplyItemId;
        data.supplyQuantity = source.supplyQuantity;
      } else if (source.productId) {
        data.productId = source.productId;
        data.quantityKg = source.quantityKg;
        data.quantityUnit = source.quantityUnit;
      } else {
        data.packagingId = source.packagingId;
        data.quantityUnit = source.quantityUnit;
      }
      await appendLedger(tx, { data });

      // Phase 2D.2A — pulihkan WAC produk dari ledger efektif pasca-void.
      // Hanya stream produk (GB/RB); packaging & supply tetap seperti existing.
      if (source.productId) {
        await recomputeProductCostInTx(tx, {
          tenantId,
          productId: source.productId,
          voidedRefId: purchase.id,
          originalRows: [source],
        });
      }

      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: "VOID",
          voidReason: trimmedReason,
          voidAt: getCurrentDate(),
        },
      });
      if (source.lotId) {
        await tx.lot.update({
          where: { id: source.lotId },
          data: { consumedAt: getCurrentDate() },
        });
      }
      await postVoidReversal("PURCHASE", purchase.id, trimmedReason, { tx, tenantId, userId });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VOID",
        entityType: "Purchase",
        entityId: purchase.id,
        before: { status: purchase.status, totalCost: Number(purchase.totalCost) },
        after: { status: "VOID", reason: trimmedReason },
      });
    },
    { isolationLevel: "Serializable" },
  );
}