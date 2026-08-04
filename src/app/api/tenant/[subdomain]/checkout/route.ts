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
import { postSalesInvoice } from "@/lib/posting";
import { paymentDestinationSnapshot, toPublicPaymentMethod } from "@/lib/manual-payments";
import { calculateStorefrontTotals, reserveInvoiceStock } from "@/lib/storefront-commerce";

type CheckoutItemInput = {
  id?: string;
  productId?: string;
  quantity?: number;
};

type InvoiceItemCreateData = {
  tenantId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  hpp: number;
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
        productId: z.string().optional(),
        quantity: z.coerce.number().int().positive().max(10_000),
      }),
    )
    .min(1)
    .max(50),
});

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

    const activePaymentMethods = await prisma.tenantPaymentMethod.findMany({
      where: { tenantId: tenant.id, isActive: true },
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
        quantity: Number(item.quantity || 0),
      }))
      .filter((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0);

    if (normalizedItems.length !== items.length) {
      return NextResponse.json({ error: "Item checkout tidak valid" }, { status: 400 });
    }

    const quantityByProduct = new Map<string, number>();
    for (const item of normalizedItems) {
      quantityByProduct.set(item.productId!, (quantityByProduct.get(item.productId!) || 0) + item.quantity);
    }

    const productIds = Array.from(quantityByProduct.keys());
    const products = await prisma.product.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: productIds },
        type: "FINISHED_GOODS",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
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

    // 2. Kalkulasi Subtotal & Buat Items Array dari data server
    let subtotal = 0;
    const invoiceItemsData: InvoiceItemCreateData[] = [];
    const midtransItemDetails: MidtransItemDetail[] = [];
    
    for (const product of products) {
      const qty = quantityByProduct.get(product.id) || 0;
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
      });

      midtransItemDetails.push({
        id: product.id,
        price: Math.round(unitPrice),
        quantity: qty,
        name: product.name.substring(0, 50)
      });
    }

    const { tax, shippingCost, grandTotal } = calculateStorefrontTotals(subtotal, shippingMethod, {
      pickupEnabled: tenant.storefrontPickupEnabled,
      deliveryEnabled: tenant.storefrontDeliveryEnabled,
      flatShippingRate: Number(tenant.storefrontFlatShippingRate),
      freeShippingMinimum: tenant.storefrontFreeShippingMinimum === null
        ? null
        : Number(tenant.storefrontFreeShippingMinimum),
      taxRate: Number(tenant.storefrontTaxRate),
    });
    if (grandTotal <= 0) {
      return NextResponse.json({ error: "Total checkout tidak valid" }, { status: 400 });
    }

    // 3. Midtrans Integration Check
    const hasMidtrans = !selectedPaymentMethod && tenant.midtransServerKey && tenant.midtransClientKey;
    let midtransOrderId = null;
    let paymentUrl = null;
    let snapToken = null;

    const invoiceCode = `INV-${tenant.code}-${getCurrentDate().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const orderPublicToken = crypto.randomBytes(24).toString("base64url");
    const paymentExpiresAt = new Date(getCurrentDate().getTime() + tenant.storefrontReservationMinutes * 60 * 1000);

    if (shippingCost > 0) {
      midtransItemDetails.push({ id: "SHIPPING", price: Math.round(shippingCost), quantity: 1, name: "Ongkos kirim" });
    }
    if (tax > 0) {
      midtransItemDetails.push({ id: "TAX", price: Math.round(tax), quantity: 1, name: `Pajak ${Number(tenant.storefrontTaxRate)}%` });
    }

    if (hasMidtrans) {
      const serverKey = decryptCredential(tenant.midtransServerKey);
      midtransOrderId = `${invoiceCode}-${Date.now().toString().slice(-6)}`;
      const snap = new midtransClient.Snap({
        isProduction: tenant.midtransIsProduction,
        serverKey,
        clientKey: tenant.midtransClientKey || "",
      });

      const parameter = {
        transaction_details: {
          order_id: midtransOrderId,
          gross_amount: Math.round(grandTotal),
        },
        customer_details: {
          first_name: customerName,
          phone: customerPhone,
          email: customerEmail || undefined,
        },
        item_details: midtransItemDetails
      };

      try {
        const transaction = await snap.createTransaction(parameter);
        snapToken = transaction.token;
        paymentUrl = transaction.redirect_url;
      } catch (err: unknown) {
        logServerError("tenant.checkout.midtrans", err, {
          requestId,
          subdomain,
        });
        // Fallback to manual if Midtrans fails
        midtransOrderId = null;
        paymentUrl = null;
      }
    }

    // 4. Buat customer, invoice, line item, dan ledger stok dalam satu transaksi dengan retry untuk P2034
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
          items: {
            create: invoiceItemsData
          }
        }
      });

      const reservation = await reserveInvoiceStock(tx, {
        tenantId: tenant.id,
        invoiceId: inv.id,
        expiresAt: paymentExpiresAt,
        items: invoiceItemsData.map((item) => ({ productId: item.productId, quantity: item.quantity })),
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

      await postSalesInvoice(
        inv.id,
        grandTotal,
        0,
        customer.name,
        invoiceItemsData.map((item) => ({
          productType: "FINISHED_GOODS" as const,
          hpp: item.hpp,
          quantity: item.quantity,
        })),
        { tx, tenantId: tenant.id, userId: createdById },
        tax,
      );

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
    });

    revalidatePath("/penjualan");
    revalidatePath("/inventory");

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, "");
    const publicOrderUrl = `${appUrl}/tenant/${subdomain}/order/${orderPublicToken}`;
    await Promise.allSettled([
      customerEmail ? sendInvoiceEmail(customerEmail, invoiceCode, publicOrderUrl) : Promise.resolve(),
      sendInvoiceWhatsApp(customerPhone, invoiceCode, publicOrderUrl),
    ]);

    return NextResponse.json({
      success: true,
      invoice: {
        code: invoice.code,
        status: invoice.status,
        grandTotal: Number(invoice.grandTotal),
      },
      snapToken,
      paymentUrl,
      orderUrl: `/tenant/${subdomain}/order/${orderPublicToken}`,
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
