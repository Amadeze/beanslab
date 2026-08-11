// =============================================================================
// TYPES — semua Decimal dikonversi ke number agar bisa di-serialize ke client
// =============================================================================

export type ProductStockRow = {
  id: string;
  code: string;
  name: string;
  type: "GREEN_BEAN" | "ROASTED_BEAN";
  origin: string | null;
  roastLevel: string | null;
  materialOrigin: "INTERNAL_ROAST" | "PURCHASED_ROASTED" | null;
  coffeeSourceId: string | null;
  stockKg: number;
  latestHppPerKg: number | null;
};

export type PackagingStockRow = {
  id: string;
  code: string;
  name: string;
  weightGrams: number;
  costPerUnit: number;
  stockUnit: number;
};

export type SupplyStockRow = {
  id: string;
  code: string;
  name: string;
  category: "PACKAGING" | "INGREDIENT" | "CONSUMABLE" | "MERCHANDISE" | "SPARE_PART" | "EQUIPMENT" | "OTHER";
  baseUnit: string;
  stockUnit: number;
  costPerUnit: number;
  trackLot: boolean;
  weightGrams: number | null;
};

export const SUPPLY_CATEGORY_LABEL: Record<SupplyStockRow["category"], string> = {
  PACKAGING: "Kemasan",
  INGREDIENT: "Bahan Non-Kopi",
  CONSUMABLE: "Habis Pakai",
  MERCHANDISE: "Barang Jualan",
  SPARE_PART: "Suku Cadang",
  EQUIPMENT: "Alat",
  OTHER: "Lainnya",
};

export type FGStockRow = {
  id: string;
  code: string;
  name: string;
  type: "FINISHED_GOODS";
  stockUnit: number;
  latestHppPerUnit: number | null;
};

export type ProductLotRow = {
  id: string;
  batchCode: string;
  expiryDate: string | null;
  receivedAt: string;
  supplierName: string | null;
  remainingKg: number;
  remainingUnit: number;
  status: LotOperationalStatus;
};

export type SupplyLotRow = {
  id: string;
  batchCode: string;
  expiryDate: string | null;
  receivedAt: string;
  supplierName: string | null;
  remainingQty: number;
  status: LotOperationalStatus;
};

export type SupplierOption = {
  id: string;
  code: string;
  name: string;
};

export type GBProductOption = {
  id: string;
  name: string;
  origin: string | null;
};

export type RBProductOption = {
  id: string;
  name: string;
  origin: string | null;
  roastLevel: string | null;
  materialOrigin: "INTERNAL_ROAST" | "PURCHASED_ROASTED" | null;
};

export type CoffeeSourceOption = {
  id: string;
  name: string;
  region: string | null;
  country: string | null;
};

export type NewCoffeeSourceInput = {
  name: string;
  country?: string | null;
  region?: string | null;
  farm?: string | null;
  species?: string | null;
  varietal?: string | null;
  processMethod?: string | null;
  fermentationMethod?: string | null;
  elevation?: string | null;
  cropYear?: string | null;
  certifications?: string[];
  tastingNotes?: string | null;
};

export type InventoryPageData = {
  gbStocks: ProductStockRow[];
  rbStocks: ProductStockRow[];
  supplyStocks: SupplyStockRow[];
  fgStocks: FGStockRow[];
  ledgerEntries: LedgerHistoryRow[];
  suppliers: SupplierOption[];
  gbProducts: GBProductOption[];
  rbProducts: RBProductOption[];
  coffeeSources: CoffeeSourceOption[];
  sampleConsumption: SampleConsumptionSummary;
  lotsByProduct: Record<string, ProductLotRow[]>;
  supplyLotsByItem: Record<string, SupplyLotRow[]>;
};

export type SampleConsumptionSummary = {
  rbConsumedKg: number;
  fgConsumedUnits: number;
  pkgConsumedUnits: number;
  totalCost: number;
  sampleCount: number;
};

export type LedgerHistoryRow = {
  id: string;
  createdAt: string;
  itemName: string;
  itemCode: string;
  itemType: "PRODUCT" | "PACKAGING";
  entryType: "IN" | "OUT";
  refType: string;
  refId: string;
  quantity: number;
  unit: "kg" | "unit";
  notes: string | null;
  createdByName: string;
};

export type PurchaseActionInput = {
  operationKey: string;
  supplierId: string;
  receivedAt: string;
  productId?: string;
  productName?: string;
  productOrigin?: string;
  weightKg: number;
  totalCost: number;
  shippingCost: number;
  paidAmount?: number;
  paymentMethod?: "CASH" | "TRANSFER" | "QRIS";
  dueDate?: string;
  notes?: string;
  lotNumber?: string;
  bestBeforeDate?: string;
};

export type RoastedBeanPurchaseInput = {
  operationKey: string;
  supplierId: string;
  receivedAt: string;
  productId?: string;
  productName?: string;
  productOrigin?: string;
  productRoastLevel?: string;
  coffeeSourceId?: string;
  coffeeSource?: NewCoffeeSourceInput;
  weightKg: number;
  totalCost: number;
  shippingCost: number;
  paidAmount?: number;
  paymentMethod?: "CASH" | "TRANSFER" | "QRIS";
  dueDate?: string;
  notes?: string;
  lotNumber?: string;
  bestBeforeDate?: string;
};

export type PackagingPurchaseInput = {
  operationKey: string;
  supplierId: string;
  receivedAt: string;
  packagingId: string;
  quantityUnits: number;
  totalCost: number;
  shippingCost: number;
  paidAmount?: number;
  paymentMethod?: "CASH" | "TRANSFER" | "QRIS";
  dueDate?: string;
  notes?: string;
  lotNumber?: string;
  bestBeforeDate?: string;
};

export type ActionResult =
  | { success: true; purchaseCode: string }
  | { success: false; error: string };

import type { LotOperationalStatus } from "@/lib/lot";