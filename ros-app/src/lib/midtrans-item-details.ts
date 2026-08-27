/**
 * Midtrans Item Details Integer Invariant Helper
 *
 * Ensures SUM(item_details.price * item_details.quantity) === gross_amount
 * by distributing rounding adjustments across line items.
 */

export interface MidtransLineItem {
  id: string;
  price: number;      // exact price per unit (can be decimal)
  quantity: number;
  name: string;
}

export interface MidtransItemDetail {
  id: string;
  price: number;      // integer price per unit (Rupiah)
  quantity: number;
  name: string;
}

/**
 * Build Midtrans item_details that exactly sum to gross_amount.
 *
 * Algorithm:
 * 1. Round each line's unit price to integer rupiah
 * 2. Add shipping and tax as separate lines (qty=1, already integers)
 * 3. Calculate current sum vs target
 * 4. If diff != 0, absorb diff using qty=1 lines (shipping/tax) first
 * 5. If no qty=1 lines available, add a synthetic rounding adjustment line
 * 6. Guarantees exact integer invariant
 */
export function buildMidtransItemDetails(
  lines: MidtransLineItem[],
  grossAmount: number,
  shippingCost: number = 0,
  tax: number = 0
): MidtransItemDetail[] {
  // Step 1: Round each line's unit price to integer
  const items: MidtransItemDetail[] = lines.map(line => ({
    id: line.id.substring(0, 50),
    price: Math.round(line.price),
    quantity: line.quantity,
    name: line.name.substring(0, 50),
  }));

  // Step 2: Add shipping and tax as separate line items (qty=1, already integers)
  const hasShipping = shippingCost > 0;
  const hasTax = tax > 0;
  if (hasShipping) {
    items.push({ id: "SHIPPING", price: Math.round(shippingCost), quantity: 1, name: "Ongkos kirim" });
  }
  if (hasTax) {
    items.push({ id: "TAX", price: Math.round(tax), quantity: 1, name: `Pajak` });
  }

  // Step 3: Calculate current sum vs target
  const currentSum = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const targetSum = Math.round(grossAmount);
  let diff = targetSum - currentSum;

  if (diff === 0) {
    return items;
  }

  // Step 4: Try to absorb diff using qty=1 lines (shipping/tax first, then others)
  const shippingIdx = items.findIndex(item => item.id === "SHIPPING");
  const taxIdx = items.findIndex(item => item.id === "TAX");
  const otherQty1Indices = items
    .map((item, idx) => ({ idx, qty: item.quantity }))
    .filter(x => x.qty === 1 && x.idx !== shippingIdx && x.idx !== taxIdx)
    .map(x => x.idx);

  const preferredIndices = [shippingIdx, taxIdx, ...otherQty1Indices].filter(idx => idx !== -1);

  if (preferredIndices.length > 0) {
    // Adjust the first preferred qty=1 item (shipping > tax > others)
    const adjustIdx = preferredIndices[0];
    items[adjustIdx].price += diff;

    // Verify
    const newSum = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (newSum === targetSum) {
      return items;
    }
    // If verification failed (shouldn't happen with qty=1), recalc diff and continue
    diff = targetSum - newSum;
  }

  // Step 5: If no qty=1 lines or adjustment didn't work, add rounding adjustment line
  // This is a legitimate accounting line for rounding differences
  items.push({
    id: "ROUNDING",
    price: diff,
    quantity: 1,
    name: "Pembulatan"
  });

  // Final verification (development only)
  if (process.env.NODE_ENV !== "production") {
    const finalSum = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (finalSum !== targetSum) {
      console.warn("[Midtrans] Item details sum mismatch after adjustment", {
        finalSum,
        targetSum,
        diff: finalSum - targetSum,
      });
    }
  }

  return items;
}