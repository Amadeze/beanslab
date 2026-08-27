// =============================================================================
// LEGACY STOCK IMPORTER — RESOLVER CONTEXT BUILDER
// =============================================================================
// Factory that constructs a tenant-scoped, read-only ResolverContext backed by
// the real Prisma client. Used by the dry-run resolver so it can perform
// existence checks (CREATE vs MATCH) without writing any data.

import { prisma } from "@/lib/prisma";
import type { ResolverContext } from "./types";

export function buildResolverContext(tenantId: string): ResolverContext {
  return {
    tenantId,
    findProductByCode: async (code: string) => {
      const product = await prisma.product.findUnique({
        where: {
          tenantId_code: { tenantId, code },
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
        },
      });
      return product;
    },
    findSupplyItemByCode: async (code: string) => {
      const supply = await prisma.inventorySupplyItem.findUnique({
        where: {
          tenantId_code: { tenantId, code },
        },
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
        },
      });
      return supply;
    },
    findSupplierByCode: async (code: string) => {
      const supplier = await prisma.supplier.findFirst({
        where: {
          tenantId,
          code: code,
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });
      return supplier;
    },
  };
}
