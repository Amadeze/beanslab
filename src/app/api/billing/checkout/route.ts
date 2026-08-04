import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { randomBytes } from "crypto";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import midtransClient from "midtrans-client";
import {
  enforceRateLimit,
  RateLimitError,
} from "@/lib/rate-limit";
import {
  layeredIdentifiers,
  resolveClientIdentity,
  tenantIdentifier,
} from "@/lib/client-identity";
import { PLAN_CATALOG } from "@/lib/plans";
import {
  getRequestId,
  internalErrorResponse,
  logServerError,
} from "@/lib/api-observability";

export async function POST(req: Request) {
  const requestId = getRequestId(req.headers);
  try {
    const session = await getIronSession<{ user?: SessionUser }>(await cookies(), SESSION_OPTIONS);
    if (!session.user || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const identity = resolveClientIdentity(req.headers);
    await enforceRateLimit({
      scope: "subscription-checkout",
      identifiers: layeredIdentifiers(identity, [tenantIdentifier(session.user.tenantId)]),
      limit: 10,
      windowSeconds: 60 * 60,
    });

    const body = (await req.json()) as { tier?: string };
    const tier = body.tier as "BASIC" | "PRO";
    const amount = PLAN_CATALOG[tier]?.monthlyPrice;
    if (!amount) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId }
    });

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    if (!serverKey || !clientKey) {
      return NextResponse.json(
        { error: "Subscription payment gateway is not configured" },
        { status: 503 },
      );
    }

    // Prepare Midtrans Snap (Superadmin's Midtrans Account)
    const snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
      serverKey,
      clientKey,
    });

    const orderId = `SUB-${tenant.id}-${Date.now()}-${randomBytes(4).toString("hex")}`;

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: tenant.name,
        email: session.user.email || tenant.contactEmail || "",
        phone: tenant.whatsappNumber || "",
      },
      item_details: [{
        id: `PLAN-${tier}`,
        price: amount,
        quantity: 1,
        name: `roastd.id ${tier} — 1 bulan`
      }]
    };

    const transaction = await snap.createTransaction(parameter);

    // Save to DB
    await prisma.subscriptionPayment.create({
      data: {
        tenantId: tenant.id,
        amount: amount,
        status: "PENDING",
        midtransOrderId: orderId,
        tier: tier,
        paymentUrl: transaction.redirect_url
      }
    });

    return NextResponse.json({ 
      token: transaction.token,
      redirect_url: transaction.redirect_url
    });

  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    logServerError("billing.checkout", error, { requestId });
    return internalErrorResponse(requestId, "Unable to create subscription payment");
  }
}
