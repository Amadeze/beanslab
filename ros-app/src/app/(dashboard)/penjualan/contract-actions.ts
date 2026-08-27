"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getCurrentTenantId,
  getSystemUserId,
  requireRole,
  requireTenantPrisma,
} from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { issueB2bAccessToken } from "@/lib/b2b-access";

// =============================================================================
// TYPES
// =============================================================================

export type ContractRow = {
  id: string;
  contractNumber: string;
  customerId: string;
  customerName: string;
  customerTier: string;
  startDate: string;
  endDate: string | null;
  terms: string | null;
  allowCredit: boolean;
  paymentTermsDays: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  priceCount: number;
};

export type ContractPriceRow = {
  id: string;
  contractId: string;
  productId: string;
  productName: string;
  productCode: string;
  tierName: string;
  minOrderQty: number;
  pricePerKg: number | null;
  pricePerUnit: number | null;
  notes: string | null;
};

export type KontrakPageData = {
  contracts: ContractRow[];
  customers: Array<{ id: string; code: string; name: string }>;
  products: Array<{ id: string; code: string; name: string }>;
};

export type ContractPricingResult = {
  success: boolean;
  prices?: ContractPriceRow[];
  error?: string;
};

// =============================================================================
// SCHEMAS
// =============================================================================

const CreateContractSchema = z.object({
  customerId: z.string().min(1),
  contractNumber: z.string().min(1).max(50),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  terms: z.string().max(10_000).optional(),
  allowCredit: z.boolean().default(false),
  paymentTermsDays: z.number().int().min(1).max(365).optional(),
}).refine((value) => !value.allowCredit || value.paymentTermsDays !== undefined, {
  message: "Termin pembayaran wajib diisi saat kredit diaktifkan.",
  path: ["paymentTermsDays"],
});

const UpdateContractSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  terms: z.string().max(10_000).optional(),
  isActive: z.boolean().optional(),
  allowCredit: z.boolean().default(false),
  paymentTermsDays: z.number().int().min(1).max(365).optional(),
}).refine((value) => !value.allowCredit || value.paymentTermsDays !== undefined, {
  message: "Termin pembayaran wajib diisi saat kredit diaktifkan.",
  path: ["paymentTermsDays"],
});

const AddContractPriceSchema = z.object({
  productId: z.string().min(1),
  tierName: z.enum(["BRONZE", "SILVER", "GOLD"]),
  minOrderQty: z.number().positive(),
  pricePerKg: z.number().positive().optional(),
  pricePerUnit: z.number().positive().optional(),
  notes: z.string().max(2_000).optional(),
}).refine((value) => value.pricePerKg !== undefined || value.pricePerUnit !== undefined, {
  message: "Isi minimal satu harga kontrak.",
});

// =============================================================================
// READ CONTRACTS
// =============================================================================

export async function getContracts(filters: { customerId?: string; isActive?: boolean } = {}): Promise<KontrakPageData> {
  await requireRole("OWNER", "MANAGER");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();

  const [contractsRaw, customers, products] = await Promise.all([
    tp.contract.findMany({
      where: {
        tenantId,
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      include: {
        customer: { select: { name: true, tier: true } },
        _count: { select: { prices: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    tp.customer.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    tp.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const contracts: ContractRow[] = contractsRaw.map((c: any) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    customerId: c.customerId,
    customerName: c.customer.name,
    customerTier: c.customer.tier,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate ? c.endDate.toISOString() : null,
    terms: c.terms,
    allowCredit: c.allowCredit,
    paymentTermsDays: c.paymentTermsDays,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    priceCount: c._count.prices,
  }));

  return { contracts, customers, products };
}

// =============================================================================
// CREATE CONTRACT
// =============================================================================

export async function createContract(input: z.infer<typeof CreateContractSchema>) {
  try {
    const parsed = CreateContractSchema.parse(input);
    await requireRole("OWNER", "MANAGER");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();

    const existing = await tp.contract.findFirst({
      where: { tenantId, customerId: parsed.customerId, contractNumber: parsed.contractNumber },
    });
    if (existing) {
      return { success: false, error: "Nomor kontrak sudah digunakan untuk pelanggan ini." };
    }

    const customer = await tp.customer.findFirst({
      where: { id: parsed.customerId, tenantId },
    });
    if (!customer) {
      return { success: false, error: "Pelanggan tidak ditemukan." };
    }

    await tp.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          tenantId,
          customerId: parsed.customerId,
          contractNumber: parsed.contractNumber,
          startDate: new Date(parsed.startDate),
          endDate: parsed.endDate ? new Date(parsed.endDate) : null,
          terms: parsed.terms || null,
          allowCredit: parsed.allowCredit,
          paymentTermsDays: parsed.allowCredit ? parsed.paymentTermsDays : null,
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE_CONTRACT",
        entityType: "Contract",
        entityId: contract.id,
        after: {
          contractNumber: parsed.contractNumber,
          customerId: parsed.customerId,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          allowCredit: parsed.allowCredit,
          paymentTermsDays: parsed.allowCredit ? parsed.paymentTermsDays : null,
        },
      });
    });

    revalidatePath("/penjualan/kontrak");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membuat kontrak." };
  }
}

// =============================================================================
// UPDATE CONTRACT
// =============================================================================

export async function updateContract(id: string, input: z.infer<typeof UpdateContractSchema>) {
  try {
    const parsed = UpdateContractSchema.parse(input);
    await requireRole("OWNER", "MANAGER");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();

    const existing = await tp.contract.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return { success: false, error: "Kontrak tidak ditemukan." };
    }

    await tp.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id },
        data: {
          startDate: new Date(parsed.startDate),
          endDate: parsed.endDate ? new Date(parsed.endDate) : null,
          terms: parsed.terms || null,
          isActive: parsed.isActive ?? existing.isActive,
          allowCredit: parsed.allowCredit,
          paymentTermsDays: parsed.allowCredit ? parsed.paymentTermsDays : null,
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "UPDATE_CONTRACT",
        entityType: "Contract",
        entityId: id,
        before: existing,
        after: {
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          isActive: parsed.isActive ?? existing.isActive,
          allowCredit: parsed.allowCredit,
          paymentTermsDays: parsed.allowCredit ? parsed.paymentTermsDays : null,
        },
      });
    });

    revalidatePath("/penjualan/kontrak");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memperbarui kontrak." };
  }
}

export async function createB2bPortalLink(contractId: string) {
  try {
    await requireRole("OWNER", "MANAGER");
    const tenantId = await getCurrentTenantId();
    const tp = await requireTenantPrisma();
    const [contract, tenant] = await Promise.all([
      tp.contract.findFirst({
        where: {
          id: contractId,
          tenantId,
          isActive: true,
          startDate: { lte: new Date() },
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          customer: {
            tenantId,
            isActive: true,
            tier: { in: ["WHOLESALE_SILVER", "WHOLESALE_GOLD"] },
          },
        },
        select: { customerId: true, endDate: true },
      }),
      tp.tenant.findFirst({ where: { id: tenantId }, select: { subdomain: true } }),
    ]);
    if (!contract || !tenant?.subdomain) {
      return { success: false as const, error: "Kontrak partner aktif atau subdomain storefront tidak ditemukan." };
    }

    const maximumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiresAt = contract.endDate && contract.endDate < maximumExpiry ? contract.endDate : maximumExpiry;
    if (expiresAt <= new Date()) {
      return { success: false as const, error: "Kontrak partner sudah berakhir." };
    }
    const token = issueB2bAccessToken({ tenantId, customerId: contract.customerId, expiresAt });
    return {
      success: true as const,
      path: `/tenant/${tenant.subdomain}?b2b=${encodeURIComponent(token)}`,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error: any) {
    return { success: false as const, error: error.message || "Gagal membuat link partner." };
  }
}

// =============================================================================
// ADD CONTRACT PRICE
// =============================================================================

export async function addContractPrice(contractId: string, input: z.infer<typeof AddContractPriceSchema>) {
  try {
    const parsed = AddContractPriceSchema.parse(input);
    await requireRole("OWNER", "MANAGER");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();

    const contract = await tp.contract.findFirst({ where: { id: contractId, tenantId } });
    if (!contract) {
      return { success: false, error: "Kontrak tidak ditemukan." };
    }

    const product = await tp.product.findFirst({ where: { id: parsed.productId, tenantId } });
    if (!product) {
      return { success: false, error: "Produk tidak ditemukan." };
    }

    await tp.$transaction(async (tx) => {
      const price = await tx.contractPrice.create({
        data: {
          contractId,
          productId: parsed.productId,
          tenantId,
          tierName: parsed.tierName,
          minOrderQty: new Prisma.Decimal(parsed.minOrderQty),
          pricePerKg: parsed.pricePerKg !== undefined ? new Prisma.Decimal(parsed.pricePerKg) : null,
          pricePerUnit: parsed.pricePerUnit !== undefined ? new Prisma.Decimal(parsed.pricePerUnit) : null,
          notes: parsed.notes || null,
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "ADD_CONTRACT_PRICE",
        entityType: "ContractPrice",
        entityId: price.id,
        after: {
          contractId,
          productId: parsed.productId,
          tierName: parsed.tierName,
          minOrderQty: parsed.minOrderQty,
          pricePerKg: parsed.pricePerKg,
          pricePerUnit: parsed.pricePerUnit,
        },
      });
    });

    revalidatePath("/penjualan/kontrak");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menambahkan harga kontrak." };
  }
}

// =============================================================================
// GET CONTRACT PRICING FOR ORDER
// =============================================================================

export async function getContractPricing(customerId: string, productId: string): Promise<ContractPricingResult> {
  await requireRole("OWNER", "MANAGER");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();

  const contract = await tp.contract.findFirst({
    where: {
      tenantId,
      customerId,
      isActive: true,
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } },
      ],
    },
    orderBy: { startDate: "desc" },
  });

  if (!contract) {
    return { success: true, prices: [] };
  }

  const prices = await tp.contractPrice.findMany({
    where: {
      contractId: contract.id,
      productId,
      tenantId,
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
    },
    orderBy: { minOrderQty: "asc" },
  });

  return {
    success: true,
    prices: prices.map((p: any) => ({
      id: p.id,
      contractId: p.contractId,
      productId: p.productId,
      productName: p.product.name,
      productCode: p.product.code,
      tierName: p.tierName,
      minOrderQty: Number(p.minOrderQty),
      pricePerKg: p.pricePerKg ? Number(p.pricePerKg) : null,
      pricePerUnit: p.pricePerUnit ? Number(p.pricePerUnit) : null,
      notes: p.notes,
    })),
  };
}

export async function getContractPrices(contractId: string): Promise<ContractPriceRow[]> {
  await requireRole("OWNER", "MANAGER");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();

  const contract = await tp.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { id: true },
  });
  if (!contract) return [];

  const prices = await tp.contractPrice.findMany({
    where: { contractId, tenantId },
    include: { product: { select: { code: true, name: true } } },
    orderBy: { minOrderQty: "asc" },
  });

  return prices.map((price) => ({
    id: price.id,
    contractId: price.contractId,
    productId: price.productId,
    productName: price.product.name,
    productCode: price.product.code,
    tierName: price.tierName,
    minOrderQty: Number(price.minOrderQty),
    pricePerKg: price.pricePerKg === null ? null : Number(price.pricePerKg),
    pricePerUnit: price.pricePerUnit === null ? null : Number(price.pricePerUnit),
    notes: price.notes,
  }));
}

// =============================================================================
// DELETE CONTRACT PRICE
// =============================================================================

export async function deleteContractPrice(id: string) {
  try {
    await requireRole("OWNER", "MANAGER");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tp = await requireTenantPrisma();

    const existing = await tp.contractPrice.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return { success: false, error: "Harga kontrak tidak ditemukan." };
    }

    await tp.$transaction(async (tx) => {
      await tx.contractPrice.delete({ where: { id } });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "DELETE_CONTRACT_PRICE",
        entityType: "ContractPrice",
        entityId: id,
        before: { contractId: existing.contractId, productId: existing.productId, tierName: existing.tierName },
      });
    });

    revalidatePath("/penjualan/kontrak");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus harga kontrak." };
  }
}
