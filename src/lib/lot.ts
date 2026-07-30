export type LotOperationalStatus = "consumed" | "expired" | "expiring_soon" | "ok";

type FlexibleNumber = number | string | { toNumber(): number } | null | undefined;

export type LotBalanceLedgerEntry = {
  entryType: "IN" | "OUT";
  quantityKg: FlexibleNumber;
  quantityUnit: FlexibleNumber;
};

export type LotInventorySummary = {
  remainingKg: number;
  remainingUnit: number;
  status: LotOperationalStatus;
};

function remainingFromLedger(
  original: number,
  entries: LotBalanceLedgerEntry[],
  field: "quantityKg" | "quantityUnit",
): number {
  if (entries.length === 0) return Math.max(0, original);
  return Math.max(0, entries.reduce((balance, entry) => {
    const amount = Number(entry[field] ?? 0);
    return balance + (entry.entryType === "IN" ? amount : -amount);
  }, 0));
}

export function summarizeLotInventory(input: {
  originalKg: FlexibleNumber;
  originalUnit: FlexibleNumber;
  ledgers: LotBalanceLedgerEntry[];
  expiryDate: Date | null;
  consumedAt: Date | null;
  now?: Date;
}): LotInventorySummary {
  const remainingKg = remainingFromLedger(Number(input.originalKg ?? 0), input.ledgers, "quantityKg");
  const remainingUnit = remainingFromLedger(Number(input.originalUnit ?? 0), input.ledgers, "quantityUnit");
  const hasOriginalQuantity = Number(input.originalKg ?? 0) > 0 || Number(input.originalUnit ?? 0) > 0;
  const isEmpty = hasOriginalQuantity && remainingKg <= 0.000001 && remainingUnit <= 0;

  if (input.consumedAt || isEmpty) {
    return { remainingKg, remainingUnit, status: "consumed" };
  }

  if (!input.expiryDate) return { remainingKg, remainingUnit, status: "ok" };
  const now = input.now ?? new Date();
  const diffDays = Math.ceil((input.expiryDate.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return { remainingKg, remainingUnit, status: "expired" };
  if (diffDays <= 30) return { remainingKg, remainingUnit, status: "expiring_soon" };
  return { remainingKg, remainingUnit, status: "ok" };
}
