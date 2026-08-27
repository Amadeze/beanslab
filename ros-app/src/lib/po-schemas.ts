/**
 * Shared Zod schemas for Purchase Order forms.
 * Consolidates validation logic from POForm and ReceivePOForm.
 */
import { z } from "zod";

// =============================================================================
// PO ITEM SCHEMA
// =============================================================================

/**
 * Schema for a single PO item (product or packaging).
 */
export const poItemSchema = z.object({
  productId: z.string().optional(),
  packagingId: z.string().optional(),
  quantity: z.number().min(0, "Quantity harus lebih dari 0"),
  unitPrice: z.number().min(0, "Harga tidak boleh negatif"),
  reorderPoint: z.number().optional(),
  currentStock: z.number().optional(),
});

export type POItemFormValues = z.infer<typeof poItemSchema>;

// =============================================================================
// CREATE/UPDATE PO SCHEMA
// =============================================================================

/**
 * Schema for creating or updating a Purchase Order.
 */
export const poFormSchema = z.object({
  supplierId: z.string().min(1, "Supplier wajib dipilih"),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(poItemSchema).min(1, "Minimal 1 item"),
});

export type POFormValues = z.infer<typeof poFormSchema>;

// =============================================================================
// RECEIVE PO SCHEMA
// =============================================================================

/**
 * Schema for receiving PO items.
 */
export const receivePOItemSchema = z.object({
  poItemId: z.string(),
  receivedQuantity: z.number().min(0, "Quantity tidak boleh negatif"),
  notes: z.string().optional(),
});

/**
 * Schema for the receive PO form.
 */
export const receivePOFormSchema = z.object({
  receivedAt: z.string().min(1, "Tanggal penerimaan wajib diisi"),
  items: z.array(receivePOItemSchema),
});

export type ReceivePOFormValues = z.infer<typeof receivePOFormSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate that at least one item has a product or packaging selected.
 */
export function validatePOItems(items: POItemFormValues[]): boolean {
  return items.some(
    (item) => (item.productId || item.packagingId) && item.quantity > 0,
  );
}

/**
 * Calculate total estimate from PO items.
 */
export function calculateTotalEstimate(items: POItemFormValues[]): number {
  return items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0,
  );
}
