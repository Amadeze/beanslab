import { randomBytes } from "node:crypto";

import { prisma, withTenant } from "../src/lib/prisma";

const suffix = randomBytes(6).toString("hex");
const tenantAId = `audit_tenant_a_${suffix}`;
const tenantBId = `audit_tenant_b_${suffix}`;
const createdIds: {
  users: string[];
  suppliers: string[];
  products: string[];
  purchases: string[];
} = {
  users: [],
  suppliers: [],
  products: [],
  purchases: [],
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  await prisma.tenant.createMany({
    data: [
      {
        id: tenantAId,
        code: `AUD-A-${suffix}`,
        name: "Tenant Isolation Audit A",
        subscriptionTier: "PRO",
        subscriptionStatus: "ACTIVE",
      },
      {
        id: tenantBId,
        code: `AUD-B-${suffix}`,
        name: "Tenant Isolation Audit B",
        subscriptionTier: "PRO",
        subscriptionStatus: "ACTIVE",
      },
    ],
  });

  const [userA, supplierA, supplierB] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Audit Owner A",
        email: `audit-a-${suffix}@example.invalid`,
        password: "not-a-login-account",
        role: "OWNER",
        tenantId: tenantAId,
      },
    }),
    prisma.supplier.create({
      data: {
        code: `SUP-A-${suffix}`,
        name: "Audit Supplier A",
        tenantId: tenantAId,
      },
    }),
    prisma.supplier.create({
      data: {
        code: `SUP-B-${suffix}`,
        name: "Audit Supplier B",
        tenantId: tenantBId,
      },
    }),
  ]);
  createdIds.users.push(userA.id);
  createdIds.suppliers.push(supplierA.id, supplierB.id);

  const tenantA = withTenant(tenantAId);
  const tenantB = withTenant(tenantBId);
  const [productA, productB] = await Promise.all([
    tenantA.product.create({
      data: {
        tenantId: tenantAId,
        code: `GB-A-${suffix}`,
        name: "Audit Green Bean A",
        type: "GREEN_BEAN",
      },
    }),
    tenantB.product.create({
      data: {
        tenantId: tenantBId,
        code: `GB-B-${suffix}`,
        name: "Audit Green Bean B",
        type: "GREEN_BEAN",
      },
    }),
  ]);
  createdIds.products.push(productA.id, productB.id);

  const visibleToA = await tenantA.product.findMany({
    where: { id: { in: [productA.id, productB.id] } },
    select: { id: true },
  });
  assert(
    visibleToA.length === 1 && visibleToA[0].id === productA.id,
    "Tenant-scoped findMany leaked a cross-tenant product.",
  );

  const crossTenantUnique = await tenantA.product.findUnique({
    where: { id: productB.id },
  });
  assert(crossTenantUnique === null, "Tenant-scoped findUnique leaked a product.");

  const grouped = await tenantA.product.groupBy({
    by: ["type"],
    where: { id: { in: [productA.id, productB.id] } },
    _count: { _all: true },
  });
  assert(
    grouped.length === 1 && grouped[0]._count._all === 1,
    "Tenant-scoped groupBy included a cross-tenant row.",
  );

  let updateRejected = false;
  try {
    await tenantA.product.update({
      where: { id: productB.id },
      data: { name: "Cross-tenant mutation" },
    });
  } catch {
    updateRejected = true;
  }
  assert(updateRejected, "Tenant-scoped update accepted a cross-tenant target.");

  let relationRejected = false;
  try {
    const purchase = await tenantA.purchase.create({
      data: {
        tenantId: tenantAId,
        code: `PUR-A-${suffix}`,
        type: "GREEN_BEAN",
        supplierId: supplierB.id,
        productId: productA.id,
        weightKg: 1,
        pricePerUnit: 1,
        totalCost: 1,
        status: "COMPLETED",
        paymentStatus: "PAID",
        paidAmount: 1,
        createdById: userA.id,
      },
    });
    createdIds.purchases.push(purchase.id);
  } catch {
    relationRejected = true;
  }
  assert(relationRejected, "Cross-tenant owned relation was accepted.");

  const transactionLeak = await tenantA.$transaction((tx) =>
    tx.product.findUnique({ where: { id: productB.id } }),
  );
  assert(transactionLeak === null, "Transaction client lost tenant isolation.");

  console.log(JSON.stringify({
    isolatedReads: true,
    isolatedGroupBy: true,
    rejectedCrossTenantUpdate: true,
    rejectedCrossTenantRelation: true,
    isolatedTransactionClient: true,
  }));
} finally {
  if (createdIds.purchases.length > 0) {
    await prisma.purchase.deleteMany({ where: { id: { in: createdIds.purchases } } });
  }
  if (createdIds.products.length > 0) {
    await prisma.product.deleteMany({ where: { id: { in: createdIds.products } } });
  }
  if (createdIds.suppliers.length > 0) {
    await prisma.supplier.deleteMany({ where: { id: { in: createdIds.suppliers } } });
  }
  if (createdIds.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
  }
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  await prisma.$disconnect();
}
