import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSerializableRetry } from "@/lib/transaction-retry";
import { revalidatePath } from "next/cache";
import midtransClient from "midtrans-client";
import { sendInvoiceEmail, sendInvoiceWhatsApp } from "@/lib/notifications";
import { getTenantAccessState } from "@/lib/subscription";
import { recordAudit } from "@/lib/audit";
import crypto from "crypto";
import { decryptCredential } from "@/lib/credentials";
import {
  enforceRateLimit,
  RateLimitError,
} from "@/lib/rate-limit";
import {
  digestIdentifier,
  layeredIdentifiers,
  phoneIdentifier,
  resolveClientIdentity,
} from "@/lib/client-identity";
import { planHasFeature } from "@/lib/plans";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";
import { z } from "zod";
import { getCurrentDate } from "@/lib/date-utils";
import { paymentDestinationSnapshot, toPublicPaymentMethod } from "@/lib/manual-payments";
import { calculateStorefrontTotals, reserveInvoiceStock } from "@/lib/storefront-commerce";
import {
  LineageResolutionError,
  resolveOfferingLineage,
} from "@/lib/storefront-catalog";
import {
  normalizeStorefrontGrind,
  offeringReserveKg,
  STOREFRONT_GRIND_SIZES,
  type StorefrontGrindSize,
} from "@/lib/storefront-grind";
import { buildMidtransItemDetails } from "@/lib/midtrans-item-details";
import { recoverOrInitializeMidtrans } from "@/lib/midtrans-gateway";

type CheckoutItemInput = {
  id?: string;
  productId?: string | null;
  offeringId?: string;
  variantId?: string;
  quantity?: number;
  grindSize?: StorefrontGrindSize;
  customGrindLabel?: string | null;
};

type InvoiceItemCreateData = {
  tenantId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  hpp: number;
  grindSize: StorefrontGrindSize;
  customGrindLabel: string | null;
  offeringId?: string | null;
  offeringVariantId?: string | null;
  offeringName?: string | null;
  packageName?: string | null;
  netWeightGrams?: number | null;
  roastLevel?: string | null;
};

type MidtransItemDetail = {
  id: string;
  price: number;
  quantity: number;
  name: string;
};

const CheckoutSchema = z.object({
  customerName: z.string().trim().min(1).max(100),
  customerPhone: z.string().trim().min(6).max(24),
  customerEmail: z.union([z.email(), z.literal("")]).optional(),
  customerAddress: z.string().trim().min(1).max(500),
  shippingMethod: z
    .enum(["PICKUP", "LOCAL_DELIVERY", "STORE_COURIER", "COURIER"])
    .default("PICKUP"),
  paymentMethodId: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        productId: z.string().nullable().optional(),
        offeringId: z.string().optional(),
        variantId: z.string().optional(),
        quantity: z.coerce.number().int().positive().max(10_000),
        grindSize: z.enum(STOREFRONT_GRIND_SIZES).default("WHOLE_BEAN"),
        customGrindLabel: z.string().trim().max(100).nullable().optional(),
      }),
    )
    .min(1)
    .max(50),
});

async function findOfferingRows(tenantId: string, offeringIds: string[]) {
  return prisma.coffeeOffering.findMany({
    where: { tenantId, id: { in: offeringIds }, isActive: true },
    select: {
      id: true,
      name: true,
      roastLevel: true,
      sourceMode: true,
      coffeeSourceId: true,
      lineageProductId: true,
      grindOptions: true,
      allowCustomGrind: true,
      variants: {
        where: { isActive: true, unitPrice: { gt: 0 } },
        select: { id: true, packageName: true, netWeightGrams: true, unitPrice: true },
      },
    },
  });
}

type CoffeeOfferingRow = Awaited<ReturnType<typeof findOfferingRows>>[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  const requestId = getRequestId(req.headers);
  let tenantSubdomain = "unknown";
  try {
    const { subdomain } = await params;
    tenantSubdomain = subdomain;
    const parsedBody = CheckoutSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Data checkout tidak valid", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }
    const identity = resolveClientIdentity(req.headers);
    await enforceRateLimit({
      scope: "tenant-checkout",
      identifiers: layeredIdentifiers(identity, [
        digestIdentifier("tenant", subdomain),
        phoneIdentifier(parsedBody.data.customerPhone),
      ]),
      limit: 30,
      windowSeconds: 10 * 60,
    });
    const {
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      shippingMethod,
      paymentMethodId,
      items,
    } = parsedBody.data;
    const rawIdempotencyKey = req.headers.get("idempotency-key")?.trim() || null;
    if (
      rawIdempotencyKey
      && (rawIdempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(rawIdempotencyKey))
    ) {
      return NextResponse.json({ error: "Idempotency key tidak valid." }, { status: 400 });
    }

    // 1. Dapatkan tenant
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
      include: { users: { take: 1, orderBy: { createdAt: 'asc' } } }
    });

    if (
      !tenant ||
      getTenantAccessState(tenant) !== "ACTIVE" ||
      !planHasFeature(tenant.subscriptionTier, "STOREFRONT")
    ) {
      return NextResponse.json({ error: "Tenant tidak ditemukan" }, { status: 404 });
    }

    const createdById = tenant.users[0]?.id;
    if (!createdById) {
      return NextResponse.json({ error: "Tenant belum memiliki user admin" }, { status: 400 });
    }

    if (rawIdempotencyKey) {
      const existing = await prisma.invoice.findUnique({
        where: {
          tenantId_operationKey: {
            tenantId: tenant.id,
            operationKey: rawIdempotencyKey,
          },
        },
      });
      if (existing?.publicOrderToken) {
        return NextResponse.json({
          success: true,
          invoice: {
            code: existing.code,
            status: existing.status,
            grandTotal: Number(existing.grandTotal),
          },
          snapToken: null,
          paymentUrl: existing.paymentUrl,
          orderUrl: `/tenant/${subdomain}/order/${existing.publicOrderToken}`,
          replayed: true,
        });
      }
    }

const activePaymentMethods = await prisma.tenantPaymentMethod.findMany({
      where: { tenantId: tenant.id, isActive: true, method: { not: "CREDIT" } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    const selectedPaymentMethod = paymentMethodId
      ? activePaymentMethods.find((method) => method.id === paymentMethodId)
      : null;
    if (paymentMethodId && !selectedPaymentMethod) {
      return NextResponse.json({ error: "Metode pembayaran tidak tersedia." }, { status: 400 });
    }
    if (activePaymentMethods.length > 0 && !selectedPaymentMethod) {
      return NextResponse.json({ error: "Pilih metode pembayaran." }, { status: 400 });
    }

    const normalizedItems = (items as CheckoutItemInput[])
      .map((item) => ({
        productId: item.productId || item.id,
        offeringId: item.offeringId ?? null,
        variantId: item.variantId ?? null,
        quantity: Number(item.quantity || 0),
        grindSize: item.grindSize ?? "WHOLE_BEAN",
        customGrindLabel: item.customGrindLabel ?? null,
      }))
      .filter((item) => {
        if (item.offeringId) return Boolean(item.variantId);
        return Boolean(item.productId && Number.isInteger(item.quantity) && item.quantity > 0);
      });

    if (normalizedItems.length !== items.length) {
      return NextResponse.json({ error: "Item checkout tidak valid" }, { status: 400 });
    }

    const productLines = normalizedItems.filter((item) => !item.offeringId);
    const offeringLines = normalizedItems.filter((item) => item.offeringId);

    const productIds = Array.from(new Set(productLines.map((item) => item.productId!)));
    const products = await prisma.product.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: productIds },
        type: "FINISHED_GOODS",
        isActive: true,
        price: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        price: true,
        recipes: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { storefrontGrindOptions: true },
        },
      },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "Ada produk yang tidak valid atau tidak aktif" }, { status: 400 });
    }

    // Batch HPP lookup to avoid N+1 queries
    const lastBatches = await prisma.productionBatch.findMany({
      where: {
        tenantId: tenant.id,
        status: "COMPLETED",
        outputProductId: { in: products.map(p => p.id) },
      },
      orderBy: { producedAt: "desc" },
      select: { outputProductId: true, hppPerUnit: true },
      distinct: ["outputProductId"],
    });
    const hppByProduct = new Map(
      lastBatches.map(b => [b.outputProductId, Number(b.hppPerUnit || 0)])
    );

    // ── Coffee offering lines: validate offering + variant, resolve the
    // lineage roasted bean product that will carry the kg reservation. ──
    let offeringById = new Map<string, CoffeeOfferingRow>();
    const lineageById = new Map<string, { productId: string; avgCostPerKg: number | null }>();
    if (offeringLines.length > 0) {
      const offeringIds = Array.from(new Set(offeringLines.map((line) => line.offeringId!)));
      const offeringRows = await findOfferingRows(tenant.id, offeringIds);
      if (offeringRows.length !== offeringIds.length) {
        return NextResponse.json({ error: "Ada penawaran yang tidak valid atau tidak aktif" }, { status: 400 });
      }
      offeringById = new Map(offeringRows.map((offering) => [offering.id, offering]));

      for (const offering of offeringRows) {
        try {
          const resolution = await resolveOfferingLineage(prisma, {
            ...offering,
            tenantId: tenant.id,
          });
          lineageById.set(offering.id, {
            productId: resolution.productId,
            avgCostPerKg: resolution.avgCostPerKg,
          });
        } catch (error) {
          return NextResponse.json(
            {
              error: error instanceof LineageResolutionError
                ? error.message
                : "Belum ada stok roasted bean untuk penawaran ini. Silakan hubungi roastery.",
            },
            { status: 400 },
          );
        }
      }
    }

    // 2. Kalkulasi Subtotal & Buat Items Array dari data server
    let subtotal = 0;
    const invoiceItemsData: InvoiceItemCreateData[] = [];
    const midtransItemDetails: MidtransItemDetail[] = [];
    
    const productById = new Map(products.map((product) => [product.id, product]));
    for (const line of productLines) {
      const product = productById.get(line.productId!);
      if (!product) {
        return NextResponse.json({ error: "Produk checkout tidak ditemukan" }, { status: 400 });
      }
      const qty = line.quantity;
      let preparation;
      try {
        preparation = normalizeStorefrontGrind(
          line.grindSize,
          line.customGrindLabel ?? undefined,
          product.recipes[0]?.storefrontGrindOptions ?? ["WHOLE_BEAN"],
        );
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Pilihan gilingan tidak valid" },
          { status: 400 },
        );
      }
      const unitPrice = Number(product.price || 0);
      const itemSub = unitPrice * qty;
      subtotal += itemSub;
      
      invoiceItemsData.push({
        tenantId: tenant.id,
        productId: product.id,
        quantity: qty,
        unitPrice: unitPrice,
        discount: 0,
        subtotal: itemSub,
        hpp: hppByProduct.get(product.id) || 0,
        grindSize: preparation.grindSize,
        customGrindLabel: preparation.customGrindLabel,
      });

      midtransItemDetails.push({
        id: `${product.id}-${preparation.grindSize}`.substring(0, 50),
        price: Math.round(unitPrice),
        quantity: qty,
        name: `${product.name} - ${preparation.grindSize}`.substring(0, 50)
      });
    }

    for (const line of offeringLines) {
      const offering = offeringById.get(line.offeringId!);
      const variant = offering?.variants.find((v: { id: string }) => v.id === line.variantId);
      const lineage = offering ? lineageById.get(offering.id) : undefined;
      if (!offering || !variant || !lineage) {
        return NextResponse.json(
          { error: "Belum ada stok roasted bean untuk penawaran ini. Silakan hubungi roastery." },
          { status: 400 },
        );
      }
      const qty = line.quantity;
      let allowed = (offering.grindOptions ?? ["WHOLE_BEAN"]) as StorefrontGrindSize[];
      if (!offering.allowCustomGrind) allowed = allowed.filter((g) => g !== "CUSTOM");
      let preparation;
      try {
        preparation = normalizeStorefrontGrind(
          line.grindSize,
          line.customGrindLabel ?? undefined,
          allowed.length > 0 ? allowed : ["WHOLE_BEAN"],
        );
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Pilihan gilingan tidak valid" },
          { status: 400 },
        );
      }
      const netWeightGrams = Number(variant.netWeightGrams);
      const unitPrice = Number(variant.unitPrice);
      const itemSub = unitPrice * qty;
      subtotal += itemSub;

      invoiceItemsData.push({
        tenantId: tenant.id,
        productId: lineage.productId,
        quantity: qty,
        unitPrice,
        discount: 0,
        subtotal: itemSub,
        // Proxy cost basis until packing flows compute exact COGS (next commit):
        // WAC per kg of the lineage roasted bean × package net weight.
        hpp: Math.round((Number(lineage.avgCostPerKg ?? 0) * netWeightGrams / 1000) * 100) / 100,
        grindSize: preparation.grindSize,
        customGrindLabel: preparation.customGrindLabel,
        offeringId: offering.id,
        offeringVariantId: variant.id,
        offeringName: offering.name,
        packageName: variant.packageName,
        netWeightGrams,
        roastLevel: offering.roastLevel ?? null,
      });

      midtransItemDetails.push({
        id: `OFF-${offering.id}-${variant.id}`.substring(0, 50),
        price: Math.round(unitPrice),
        quantity: qty,
        name: `${offering.name} ${variant.packageName}`.substring(0, 50)
      });
    }

let tax: number, shippingCost: number, grandTotal: number;
    try {
      const totals = calculateStorefrontTotals(subtotal, shippingMethod, {
        pickupEnabled: tenant.storefrontPickupEnabled,
        deliveryEnabled: tenant.storefrontDeliveryEnabled,
        flatShippingRate: Number(tenant.storefrontFlatShippingRate),
        freeShippingMinimum: tenant.storefrontFreeShippingMinimum === null
          ? null
          : Number(tenant.storefrontFreeShippingMinimum),
        taxRate: Number(tenant.storefrontTaxRate),
      });
      tax = totals.tax;
      shippingCost = totals.shippingCost;
      grandTotal = totals.grandTotal;
    } catch (err) {
      if (err instanceof Error) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      return NextResponse.json({ error: "Konfigurasi pengiriman tidak valid" }, { status: 400 });
    }
    if (grandTotal <= 0) {
      return NextResponse.json({ error: "Total checkout tidak valid" }, { status: 400 });
    }

    // 3. Prepare Midtrans integration (if configured)
    const hasMidtrans = !selectedPaymentMethod && tenant.midtransServerKey && tenant.midtransClientKey;
    let midtransOrderId: string | null = null;
    let paymentUrl: string | null = null;
    let snapToken: string | null = null;

    const invoiceCode = `INV-${tenant.code}-${getCurrentDate().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const orderPublicToken = crypto.randomBytes(24).toString("base64url");
    const paymentExpiresAt = new Date(getCurrentDate().getTime() + tenant.storefrontReservationMinutes * 60 * 1000);

    if (shippingCost > 0) {
      midtransItemDetails.push({ id: "SHIPPING", price: Math.round(shippingCost), quantity: 1, name: "Ongkos kirim" });
    }
    if (tax > 0) {
      midtransItemDetails.push({ id: "TAX", price: Math.round(tax), quantity: 1, name: `Pajak ${Number(tenant.storefrontTaxRate)}%` });
    }

    // Derive deterministic Midtrans order ID upfront (for idempotency)
    if (hasMidtrans) {
      midtransOrderId = rawIdempotencyKey
        ? `${tenant.code}-${crypto.createHash("sha256").update(rawIdempotencyKey).digest("hex").slice(0, 24)}`
        : `${invoiceCode}-${Date.now().toString().slice(-6)}`;
    }

    // 4. Buat customer, invoice, line item, dan ledger stok dalam satu transaksi dengan retry untuk P2034
    let replayed = false;
    const invoice = await withSerializableRetry(prisma, async (tx) => {
      let customer = await tx.customer.findFirst({
        where: { tenantId: tenant.id, phone: customerPhone }
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            code: `CST-${tenant.code}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
            name: customerName,
            phone: customerPhone,
            email: customerEmail || null,
            address: customerAddress,
            tenantId: tenant.id,
          }
        });
      }

      const inv = await tx.invoice.create({
        data: {
          code: invoiceCode,
          operationKey: rawIdempotencyKey,
          customerId: customer.id,
          tenantId: tenant.id,
          createdById,
          status: "ISSUED",
          subtotal,
          discount: 0,
          tax,
          taxRate: Number(tenant.storefrontTaxRate),
          taxType: tax > 0 ? "PPN" : "NONE",
          taxableAmount: subtotal,
          shippingCost,
          shippingMethod: shippingMethod || "PICKUP",
          shippingAddress: shippingMethod === "PICKUP" ? null : customerAddress || null,
          grandTotal,
          publicOrderToken: orderPublicToken,
          reservationExpiresAt: paymentExpiresAt,
          midtransOrderId,
          paymentUrl,
          paymentMethod: selectedPaymentMethod?.method ?? null,
          salesChannel: "STOREFRONT",
          items: {
            create: invoiceItemsData
          }
        }
      });

      // Aggregate per lineage product: product lines reserve stock units;
      // offering lines preserve package count and reserve exact kg on the RB.
      const reserveMap = new Map<string, { productId: string; quantity: number; quantityKg: number | null }>();
      for (const item of invoiceItemsData) {
        const entry = reserveMap.get(item.productId) ?? { productId: item.productId, quantity: 0, quantityKg: null };
        if (item.offeringId && item.netWeightGrams) {
          const { units, quantityKg } = offeringReserveKg(item.quantity, item.netWeightGrams);
          entry.quantity += units;
          entry.quantityKg = (entry.quantityKg ?? 0) + quantityKg;
        } else {
          entry.quantity += item.quantity;
        }
        reserveMap.set(item.productId, entry);
      }
      const reservation = await reserveInvoiceStock(tx, {
        tenantId: tenant.id,
        invoiceId: inv.id,
        expiresAt: paymentExpiresAt,
        items: Array.from(reserveMap.values()),
      });
      if (reservation.hasShortage) {
        await tx.invoice.update({ where: { id: inv.id }, data: { fulfillmentStatus: "NEEDS_PRODUCTION" } });
      }

      if (selectedPaymentMethod) {
        const publicMethod = toPublicPaymentMethod(selectedPaymentMethod);
        await tx.paymentSubmission.create({
          data: {
            tenantId: tenant.id,
            invoiceId: inv.id,
            paymentMethodId: selectedPaymentMethod.id,
            publicToken: orderPublicToken,
            provider: selectedPaymentMethod.provider,
            method: selectedPaymentMethod.method,
            amount: grandTotal,
            destination: paymentDestinationSnapshot(publicMethod),
            expiresAt: paymentExpiresAt,
          },
        });
      }

      await recordAudit(tx, {
        tenantId: tenant.id,
        userId: createdById,
        action: "CREATE_PUBLIC",
        entityType: "Invoice",
        entityId: inv.id,
        after: {
          code: inv.code,
          status: inv.status,
          grandTotal: Number(inv.grandTotal),
        },
        metadata: { itemCount: invoiceItemsData.length },
      });

      return inv;
    }).catch(async (error: unknown) => {
      const prismaCode = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : null;
      if (prismaCode !== "P2002" || !rawIdempotencyKey) throw error;
      const existing = await prisma.invoice.findUnique({
        where: {
          tenantId_operationKey: {
            tenantId: tenant.id,
            operationKey: rawIdempotencyKey,
          },
        },
      });
      if (!existing) throw error;
      replayed = true;
      return existing;
    });

    // 5. Recover or initialize Midtrans AFTER invoice is committed (idempotent)
    if (hasMidtrans) {
      // Prepare line items with exact prices for invariant-safe rounding
      const midtransLines = invoiceItemsData.map(item => {
        const product = productById.get(item.productId);
        return {
          id: item.offeringId
            ? `OFF-${item.offeringId}-${item.offeringVariantId}`.substring(0, 50)
            : `${item.productId}-${item.grindSize}`.substring(0, 50),
          price: item.unitPrice,  // exact price
          quantity: item.quantity,
          name: item.offeringId
            ? `${item.offeringName} ${item.packageName}`.substring(0, 50)
            : `${product?.name || "Product"} - ${item.grindSize}`.substring(0, 50),
        };
      });

      const safeItemDetails = buildMidtransItemDetails(
        midtransLines,
        grandTotal,
        shippingCost,
        tax
      );

      // Use recovery logic that handles Windows A/B/C/D
      const recovery = await recoverOrInitializeMidtrans(
        {
          midtransServerKey: tenant.midtransServerKey!,
          midtransClientKey: tenant.midtransClientKey || "",
          midtransIsProduction: tenant.midtransIsProduction
        },
        {
          id: invoice.id,
          code: invoice.code,
          midtransOrderId: invoice.midtransOrderId,
          paymentUrl: invoice.paymentUrl,
          snapToken: null, // Invoice model doesn't have snapToken field
          grandTotal,
          customerName,
          customerPhone,
          customerEmail: customerEmail ?? null,
          itemDetails: safeItemDetails,
        }
      );

      snapToken = recovery.snapToken;
      paymentUrl = recovery.paymentUrl;

      // Persist recovered/initialized Midtrans result
      if (recovery.action !== "noop" && recovery.action !== "terminal" && recovery.paymentUrl) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { midtransOrderId: invoice.midtransOrderId, paymentUrl: recovery.paymentUrl },
        });
      }

      // Log recovery action for observability
      if (recovery.action !== "noop") {
        logServerError("tenant.checkout.midtrans.recovery", new Error(`Midtrans recovery action: ${recovery.action}`), {
          requestId,
          subdomain,
          invoiceId: invoice.id,
          midtransOrderId: invoice.midtransOrderId,
          action: recovery.action,
        });
      }
    }

    revalidatePath("/penjualan");
    revalidatePath("/inventory");

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, "");
    const resolvedPublicOrderToken = invoice.publicOrderToken ?? orderPublicToken;
    const publicOrderUrl = `${appUrl}/tenant/${subdomain}/order/${resolvedPublicOrderToken}`;
    if (!replayed) {
      await Promise.allSettled([
        customerEmail ? sendInvoiceEmail(customerEmail, invoice.code, publicOrderUrl) : Promise.resolve(),
        sendInvoiceWhatsApp(customerPhone, invoice.code, publicOrderUrl),
      ]);
    }

return NextResponse.json({
      success: true,
      invoice: {
        code: invoice.code,
        status: invoice.status,
        grandTotal: Number(invoice.grandTotal),
      },
      snapToken,
      paymentUrl,
      orderUrl: `/tenant/${subdomain}/order/${resolvedPublicOrderToken}`,
      replayed,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    logServerError("tenant.checkout", error, {
      requestId,
      subdomain: tenantSubdomain,
    });
    return internalErrorResponse(requestId);
  }
}
