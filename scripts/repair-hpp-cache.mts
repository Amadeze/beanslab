import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const products = await prisma.product.findMany({
    where: { type: "FINISHED_GOODS" },
    select: {
      id: true,
      tenantId: true,
      code: true,
      name: true,
      lastHpp: true,
      productionBatches: {
        where: { status: "COMPLETED" },
        orderBy: [{ producedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { id: true, hppPerUnit: true },
      },
    },
  });

  const repairs = products.flatMap((product) => {
    const latest = product.productionBatches[0];
    const expected = latest?.hppPerUnit ?? null;
    const currentValue = product.lastHpp?.toString() ?? null;
    const expectedValue = expected?.toString() ?? null;
    if (currentValue === expectedValue) return [];

    return [{
      id: product.id,
      tenantId: product.tenantId,
      code: product.code,
      name: product.name,
      currentHpp: currentValue,
      expectedHpp: expectedValue,
      sourceBatchId: latest?.id ?? null,
      value: expected,
    }];
  });

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", repairs: repairs.map(({ value: _value, ...repair }) => repair) }, null, 2));

  if (apply && repairs.length > 0) {
    await prisma.$transaction(
      repairs.map((repair) =>
        prisma.product.update({
          where: { id: repair.id },
          data: { lastHpp: repair.value },
        }),
      ),
    );
    console.log(JSON.stringify({ applied: repairs.length }));
  }
} finally {
  await prisma.$disconnect();
}
