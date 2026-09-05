import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getCurrentDate } from "@/lib/date-utils";
import { bucketAging } from "./contractAging";

export interface ContractListItem {
  id: string;
  contractNumber: string;
  customerName: string;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  allowCredit: boolean;
  paymentTermsDays: number | null;
  openInvoiceCount: number;
  openInvoiceTotal: number;
}

export interface ContractDetailItem {
  id: string;
  contractNumber: string;
  customerId: string;
  customerName: string;
  customerTier: string | null;
  startDate: Date;
  endDate: Date | null;
  terms: string | null;
  allowCredit: boolean;
  paymentTermsDays: number | null;
  isActive: boolean;
  prices: Array<{
    productId: string;
    productName: string;
    tierName: string;
    minOrderQty: number;
    pricePerKg: number | null;
    pricePerUnit: number | null;
  }>;
  invoices: Array<{
    id: string;
    code: string;
    createdAt: Date;
    grandTotal: number;
    paidAmount: number;
    outstanding: number;
    status: string;
    dueDate: Date | null;
    ageDays: number | null;
  }>;
  aging: {
    current: number;
    d1to30: number;
    d31to60: number;
    d61to90: number;
    over90: number;
  };
}

function daysBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export async function listContractsForTenant(): Promise<ContractListItem[]> {
  const user = await requireRole("OWNER", "MANAGER");
  const contracts = await prisma.contract.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    include: {
      customer: { select: { name: true } },
    },
  });

  const customerIds = contracts.map((contract) => contract.customerId);
  const openInvoices = customerIds.length
    ? await prisma.invoice.findMany({
        where: {
          tenantId: user.tenantId,
          customerId: { in: customerIds },
          status: { in: ["ISSUED", "PARTIAL"] },
          voidAt: null,
        },
        select: { customerId: true, grandTotal: true, paidAmount: true, returnedAmount: true },
      })
    : [];
  const outstandingByCustomer = new Map<string, { count: number; total: number }>();
  for (const invoice of openInvoices) {
    const outstanding = Math.max(
      0,
      Number(invoice.grandTotal) - Number(invoice.paidAmount) - Number(invoice.returnedAmount),
    );
    if (outstanding <= 0.01) continue;
    const acc = outstandingByCustomer.get(invoice.customerId) ?? { count: 0, total: 0 };
    acc.count += 1;
    acc.total += outstanding;
    outstandingByCustomer.set(invoice.customerId, acc);
  }

  return contracts.map((contract) => {
    const acc = outstandingByCustomer.get(contract.customerId) ?? { count: 0, total: 0 };
    return {
      id: contract.id,
      contractNumber: contract.contractNumber,
      customerName: contract.customer.name,
      startDate: contract.startDate,
      endDate: contract.endDate,
      isActive: contract.isActive,
      allowCredit: contract.allowCredit,
      paymentTermsDays: contract.paymentTermsDays,
      openInvoiceCount: acc.count,
      openInvoiceTotal: acc.total,
    };
  });
}

export async function loadContractDetail(
  contractId: string,
): Promise<ContractDetailItem | null> {
  const user = await requireRole("OWNER", "MANAGER");
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: user.tenantId },
    include: {
      customer: { select: { id: true, name: true, tier: true } },
      prices: {
        include: { product: { select: { id: true, name: true } } },
        orderBy: [{ productId: "asc" }, { minOrderQty: "asc" }],
      },
    },
  });
  if (!contract) return null;

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: user.tenantId,
      customerId: contract.customerId,
      voidAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      code: true,
      createdAt: true,
      dueDate: true,
      grandTotal: true,
      paidAmount: true,
      returnedAmount: true,
      status: true,
    },
  });

  const now = getCurrentDate();
  const invoiceItems: ContractDetailItem["invoices"] = invoices.map((invoice) => {
    const outstanding = Math.max(
      0,
      Number(invoice.grandTotal) - Number(invoice.paidAmount) - Number(invoice.returnedAmount),
    );
    const dueDate = invoice.dueDate ?? null;
    const ageDays = outstanding > 0 && dueDate ? daysBetween(dueDate, now) : null;
    return {
      id: invoice.id,
      code: invoice.code,
      createdAt: invoice.createdAt,
      grandTotal: Number(invoice.grandTotal),
      paidAmount: Number(invoice.paidAmount),
      outstanding,
      status: invoice.status,
      dueDate,
      ageDays,
    };
  });

  const aging = bucketAging(
    invoiceItems
      .filter((invoice) => invoice.outstanding > 0.01)
      .map((invoice) => ({ outstanding: invoice.outstanding, dueDate: invoice.dueDate })),
    now,
  );

  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    customerId: contract.customerId,
    customerName: contract.customer.name,
    customerTier: contract.customer.tier,
    startDate: contract.startDate,
    endDate: contract.endDate,
    terms: contract.terms,
    allowCredit: contract.allowCredit,
    paymentTermsDays: contract.paymentTermsDays,
    isActive: contract.isActive,
    prices: contract.prices.map((price) => ({
      productId: price.product.id,
      productName: price.product.name,
      tierName: price.tierName,
      minOrderQty: Number(price.minOrderQty),
      pricePerKg: price.pricePerKg ? Number(price.pricePerKg) : null,
      pricePerUnit: price.pricePerUnit ? Number(price.pricePerUnit) : null,
    })),
    invoices: invoiceItems,
    aging,
  };
}