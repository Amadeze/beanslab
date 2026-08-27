/**
 * Formula keuangan kanonik yang ditampilkan di UI (2F.3).
 * Definisi terkunci 2F.2 — jangan mengubah semantik posting/GL.
 */

/** Piutang (AR) = tagihan − pembayaran − nilai retur, tidak pernah negatif. */
export function computeReceivable(
  grandTotal: number,
  paidAmount: number,
  returnedAmount: number,
): number {
  return Math.max(
    0,
    Math.round((grandTotal - paidAmount - returnedAmount) * 100) / 100,
  );
}

/** Hutang Supplier (AP) = total biaya − pembayaran, tidak pernah negatif. */
export function computePayable(totalCost: number, paidAmount: number): number {
  return Math.max(0, Math.round((totalCost - paidAmount) * 100) / 100);
}