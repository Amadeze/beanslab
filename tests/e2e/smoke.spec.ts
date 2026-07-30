import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";
import crypto from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";

import { SESSION_OPTIONS } from "../../src/lib/session";
import { getTenantAccessState } from "../../src/lib/subscription";

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/inventory",
  "/roasting",
  "/produksi",
  "/penjualan",
  "/penjualan/pembayaran",
  "/keuangan",
  "/laporan/keuangan",
  "/katalog",
  "/audit",
  "/settings",
  "/settings/payments",
  "/onboarding",
  "/billing",
];

test("public and protected routes behave correctly", async ({ page, request }) => {
  test.setTimeout(90_000);
  const webglErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("WebGL")) {
      webglErrors.push(message.text());
    }
  });
  await expect((await page.goto("/login"))?.status()).toBe(200);
  await expect((await page.goto("/register"))?.status()).toBe(200);
  await expect((await page.goto("/forgot-password"))?.status()).toBe(200);
  await expect((await page.goto("/reset-password"))?.status()).toBe(200);

  const tenantResponse = await page.goto("/tenant/nalweng");
  expect([200, 404]).toContain(tenantResponse?.status());
  if (tenantResponse?.status() === 200) {
    const publicHtml = await page.content();
    expect(publicHtml).not.toContain("midtransServerKey");
    expect(publicHtml).not.toContain("artisanWebhookToken");
    expect(publicHtml).not.toContain("enc:v1");
  }

  const protectedResponse = await page.goto("/dashboard");
  expect(protectedResponse?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login\?from=%2Fdashboard$/);

  const tenantWebhook = await request.post("/api/webhooks/tenant-midtrans", {
    data: {},
  });
  expect(tenantWebhook.status()).toBe(400);

  const artisanWebhook = await request.post("/api/webhooks/artisan", {
    data: {},
  });
  expect(artisanWebhook.status()).toBe(401);

  const readiness = await request.get("/api/health");
  expect([200, 503]).toContain(readiness.status());
  const readinessBody = await readiness.json();
  expect(readinessBody.database).toBe("reachable");
  expect(readinessBody.status).toBe(readiness.status() === 200 ? "ok" : "degraded");
  expect(readiness.headers()["x-request-id"]).toMatch(/^[A-Za-z0-9._-]{1,80}$/);

  const liveness = await request.get("/api/health/live", {
    headers: { "X-Request-Id": "e2e-health-trace" },
  });
  expect(liveness.status()).toBe(200);
  expect(liveness.headers()["x-request-id"]).toBe("e2e-health-trace");

  const invalidRequestId = await request.get("/api/health/live", {
    headers: { "X-Request-Id": "invalid request id" },
  });
  expect(invalidRequestId.status()).toBe(200);
  expect(invalidRequestId.headers()["x-request-id"]).not.toBe("invalid request id");
  expect(invalidRequestId.headers()["x-request-id"]).toMatch(/^[A-Za-z0-9._-]{1,80}$/);

  const unauthorizedCron = await request.post("/api/cron/subscriptions");
  expect(unauthorizedCron.status()).toBe(401);
  const unauthorizedReminderCron = await request.post("/api/cron/overdue-reminders");
  expect(unauthorizedReminderCron.status()).toBe(401);
  const unauthorizedPaymentExpiryCron = await request.post("/api/cron/payment-submissions");
  expect(unauthorizedPaymentExpiryCron.status()).toBe(401);
  expect(webglErrors).toEqual([]);
});

test("all owner dashboard modules render", async ({ context, page }) => {
  test.setTimeout(180_000);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required for authenticated smoke tests.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  let temporaryPurchaseId: string | null = null;
  let temporaryPurchaseCode: string | null = null;

  try {
    const owners = await prisma.user.findMany({
      where: {
        isActive: true,
        role: "OWNER",
        tenant: { isActive: true },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        tenant: {
          select: {
            isActive: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            trialEndsAt: true,
            nextBillingDate: true,
          },
        },
      },
    });
    const owner = owners.find(
      (candidate) => getTenantAccessState(candidate.tenant) === "ACTIVE",
    );

    test.skip(!owner, "An owner with active tenant access is required.");

    const { tenant: _tenant, ...user } = owner!;

    const sessionCookie = await sealData(
      { user },
      {
        password: SESSION_OPTIONS.password,
        ttl: SESSION_OPTIONS.cookieOptions.maxAge,
      },
    );

    await context.addCookies([
      {
        name: SESSION_OPTIONS.cookieName,
        value: sessionCookie,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const [supplier, greenBean, packaging] = await Promise.all([
      prisma.supplier.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
        select: { id: true },
      }),
      prisma.product.findFirst({
        where: { tenantId: user.tenantId, isActive: true, type: "GREEN_BEAN" },
        select: { id: true },
      }),
      prisma.packaging.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (supplier && (greenBean || packaging)) {
      temporaryPurchaseCode = `E2E-AP-${Date.now()}`;
      const purchase = await prisma.purchase.create({
        data: {
          code: temporaryPurchaseCode,
          type: greenBean ? "GREEN_BEAN" : "PACKAGING",
          supplierId: supplier.id,
          productId: greenBean?.id,
          packagingId: greenBean ? undefined : packaging!.id,
          weightKg: greenBean ? 1 : undefined,
          quantityUnits: greenBean ? undefined : 1,
          pricePerUnit: 10_000,
          shippingCost: 0,
          totalCost: 10_000,
          status: "COMPLETED",
          paymentStatus: "UNPAID",
          paidAmount: 0,
          dueDate: new Date(Date.now() + 86_400_000),
          receivedAt: new Date(),
          createdById: user.id,
          tenantId: user.tenantId,
        },
      });
      temporaryPurchaseId = purchase.id;
    }

    const spoofedUpload = await context.request.post("/api/upload", {
      multipart: {
        file: {
          name: "spoofed.png",
          mimeType: "image/png",
          buffer: Buffer.from("<svg></svg>"),
        },
      },
    });
    expect(spoofedUpload.status()).toBe(400);

    for (const route of DASHBOARD_ROUTES) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), route).toBe(200);
      await expect(page, route).not.toHaveURL(/\/login/);
      if (route === "/inventory") {
        const mutationsLink = page
          .getByRole("navigation", { name: "Navigasi workspace supply" })
          .getByRole("link", { name: "Mutasi", exact: true });
        const mutationsSearch = page.getByPlaceholder("Cari item, referensi, atau operator...");
        await expect(async () => {
          await mutationsLink.click();
          await expect(mutationsSearch).toBeVisible();
        }).toPass({ timeout: 15_000 });
      }
      if (route === "/penjualan/pembayaran") {
        await expect(page.getByRole("tab", { name: /Perlu dicek/ })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Riwayat" })).toBeVisible();
      }
      if (route === "/settings/payments") {
        await expect(page.getByText("Jalur aktif sekarang")).toBeVisible();
      }
      if (route === "/onboarding") {
        await expect(page.getByRole("heading", { name: "Siapkan alur yang benar-benar dipakai" })).toBeVisible();
      }
      if (route === "/keuangan") {
        const paymentTab = page.getByRole("tab", { name: /^Pembayaran \(/ });
        await expect(async () => {
          await paymentTab.click();
          await expect(page.getByTestId("payment-history")).toBeVisible();
        }).toPass({ timeout: 15_000 });

        if (temporaryPurchaseCode) {
          await page.getByRole("tab", { name: /^Hutang Supplier \(/ }).click();
          const purchaseRow = page.getByRole("row").filter({ hasText: temporaryPurchaseCode });
          await expect(purchaseRow).toBeVisible();
          await purchaseRow.getByRole("button", { name: `Bayar ${temporaryPurchaseCode}` }).click();
          await expect(page.getByRole("heading", { name: "Bayar Supplier" })).toBeVisible();
          await page.getByRole("button", { name: "Catat Pembayaran" }).click();
          await expect(page.getByRole("heading", { name: "Bayar Supplier" })).not.toBeVisible();

          await page.getByRole("tab", { name: /^Bayar Supplier \(/ }).click();
          await expect(page.getByText(temporaryPurchaseCode).filter({ visible: true })).toBeVisible();
        }
      }
      if (route === "/audit") {
        await page.getByRole("link", { name: /^Reminder \(/ }).click();
        await expect(page.getByTestId("reminder-deliveries")).toBeVisible();
      }
      if (route === "/settings") {
        const settingsHtml = await page.content();
        expect(settingsHtml).not.toContain("artisanWebhookToken");
        expect(settingsHtml).not.toContain("enc:v1");
      }
    }
  } finally {
    if (temporaryPurchaseId) {
      await prisma.supplierPayment.deleteMany({
        where: { purchaseId: temporaryPurchaseId },
      });
      await prisma.purchase.deleteMany({
        where: { id: temporaryPurchaseId },
      });
    }
    await prisma.$disconnect();
  }
});

test("tenant Midtrans webhook is idempotent and rejects overpayment", async ({ request }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required for webhook tests.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tenantId = `e2e-midtrans-${suffix}`;
  const serverKey = `SB-Mid-server-${suffix}`;

  try {
    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        code: `E2E-MID-${suffix}`,
        name: "E2E Midtrans Tenant",
        subscriptionTier: "PRO",
        subscriptionStatus: "ACTIVE",
        // This suite verifies webhook semantics. Credential encryption has
        // separate unit/preflight coverage and would couple the reused dev
        // server to the Playwright process environment.
        midtransServerKey: serverKey,
      },
    });
    const user = await prisma.user.create({
      data: {
        name: "E2E Owner",
        email: `e2e-midtrans-${suffix}@example.invalid`,
        password: "not-a-login-account",
        role: "OWNER",
        tenantId,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        code: `CUS-${suffix}`,
        name: "E2E Customer",
        tenantId,
      },
    });

    const createInvoice = (code: string, orderId: string, paidAmount = 0) =>
      prisma.invoice.create({
        data: {
          code,
          customerId: customer.id,
          subtotal: 10_000,
          discount: 0,
          tax: 0,
          shippingCost: 0,
          grandTotal: 10_000,
          paidAmount,
          status: paidAmount > 0 ? "PARTIAL" : "ISSUED",
          dueDate: new Date(Date.now() + 86_400_000),
          midtransOrderId: orderId,
          createdById: user.id,
          tenantId,
        },
      });

    const paidInvoice = await createInvoice(`INV-PAID-${suffix}`, `ORDER-PAID-${suffix}`);
    const payloadFor = (orderId: string, transactionId: string) => {
      const statusCode = "200";
      const grossAmount = "10000.00";
      return {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        transaction_status: "settlement",
        transaction_id: transactionId,
        payment_type: "bank_transfer",
        signature_key: crypto
          .createHash("sha512")
          .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
          .digest("hex"),
      };
    };

    const paidPayload = payloadFor(paidInvoice.midtransOrderId!, `TRX-${suffix}`);
    const first = await request.post("/api/webhooks/tenant-midtrans", {
      data: paidPayload,
    });
    const firstBody = await first.json();
    expect(first.status(), JSON.stringify(firstBody)).toBe(200);
    expect(firstBody.success).toBe(true);

    const replay = await request.post("/api/webhooks/tenant-midtrans", {
      data: paidPayload,
    });
    expect(replay.status()).toBe(200);
    expect((await replay.json()).duplicate).toBe(true);

    const paidState = await prisma.invoice.findUnique({
      where: { id: paidInvoice.id },
      select: { status: true, paidAmount: true, payments: true },
    });
    expect(paidState?.status).toBe("PAID");
    expect(Number(paidState?.paidAmount)).toBe(10_000);
    expect(paidState?.payments).toHaveLength(1);

    const partialInvoice = await createInvoice(
      `INV-PART-${suffix}`,
      `ORDER-PART-${suffix}`,
      1_000,
    );
    await prisma.payment.create({
      data: {
        code: `PAY-MANUAL-${suffix}`,
        invoiceId: partialInvoice.id,
        amount: 1_000,
        method: "TRANSFER",
        reference: `MANUAL-${suffix}`,
        createdById: user.id,
        tenantId,
      },
    });
    const overpayment = await request.post("/api/webhooks/tenant-midtrans", {
      data: payloadFor(partialInvoice.midtransOrderId!, `TRX-PART-${suffix}`),
    });
    expect(overpayment.status()).toBe(409);

    const partialState = await prisma.invoice.findUnique({
      where: { id: partialInvoice.id },
      select: { status: true, paidAmount: true, payments: true },
    });
    expect(partialState?.status).toBe("PARTIAL");
    expect(Number(partialState?.paidAmount)).toBe(1_000);
    expect(partialState?.payments).toHaveLength(1);
    const ignoredEvent = await prisma.webhookEvent.findFirst({
      where: {
        tenantId,
        provider: "MIDTRANS_TENANT",
        eventId: {
          startsWith: `${partialInvoice.midtransOrderId}:settlement:`,
        },
      },
      select: { status: true },
    });
    expect(ignoredEvent?.status).toBe("IGNORED");
  } finally {
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.webhookEvent.deleteMany({ where: { tenantId } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId } });
    await prisma.account.deleteMany({ where: { tenantId } });
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.invoiceItem.deleteMany({
      where: { invoice: { tenantId } },
    });
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }
});

test("subscription webhook keeps successful payments terminal", async ({ request }) => {
  test.setTimeout(60_000);
  test.skip(
    !process.env.DATABASE_URL || !process.env.MIDTRANS_SERVER_KEY,
    "Database and MIDTRANS_SERVER_KEY are required.",
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tenantId = `e2e-subscription-${suffix}`;
  const orderId = `SUB-E2E-${suffix}`;
  const amount = 299_000;

  const payload = (transactionStatus: string, statusCode: string) => {
    const grossAmount = `${amount}.00`;
    return {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      transaction_status: transactionStatus,
      signature_key: crypto
        .createHash("sha512")
        .update(`${orderId}${statusCode}${grossAmount}${process.env.MIDTRANS_SERVER_KEY}`)
        .digest("hex"),
    };
  };

  try {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        code: `E2E-SUB-${suffix}`,
        name: "E2E Subscription Tenant",
        subscriptionTier: "BASIC",
        subscriptionStatus: "PAST_DUE",
      },
    });
    const payment = await prisma.subscriptionPayment.create({
      data: {
        tenantId,
        amount,
        status: "PENDING",
        midtransOrderId: orderId,
        tier: "PRO",
      },
    });

    const settlement = await request.post("/api/webhooks/superadmin-midtrans", {
      data: payload("settlement", "200"),
    });
    expect(settlement.status()).toBe(200);

    const successful = await prisma.subscriptionPayment.findUnique({
      where: { id: payment.id },
      include: { tenant: true },
    });
    expect(successful?.status).toBe("SUCCESS");
    expect(successful?.tenant.subscriptionTier).toBe("PRO");
    expect(successful?.tenant.subscriptionStatus).toBe("ACTIVE");
    expect(successful?.tenant.nextBillingDate).not.toBeNull();

    const lateExpire = await request.post("/api/webhooks/superadmin-midtrans", {
      data: payload("expire", "407"),
    });
    expect(lateExpire.status()).toBe(200);

    const terminal = await prisma.subscriptionPayment.findUnique({
      where: { id: payment.id },
      include: { tenant: true },
    });
    expect(terminal?.status).toBe("SUCCESS");
    expect(terminal?.tenant.subscriptionTier).toBe("PRO");
    expect(terminal?.tenant.subscriptionStatus).toBe("ACTIVE");
  } finally {
    await prisma.webhookEvent.deleteMany({ where: { tenantId } });
    await prisma.subscriptionPayment.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }
});

test("Artisan DROP attaches telemetry exactly once", async ({ request }) => {
  test.setTimeout(60_000);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tenantId = `e2e-artisan-${suffix}`;
  const token = `artisan-token-${suffix}`;

  try {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        code: `E2E-ART-${suffix}`,
        name: "E2E Artisan Tenant",
        subscriptionTier: "PRO",
        subscriptionStatus: "ACTIVE",
        isArtisanEnabled: true,
        artisanWebhookToken: token,
      },
    });
    const user = await prisma.user.create({
      data: {
        name: "E2E Roaster",
        email: `e2e-artisan-${suffix}@example.invalid`,
        password: "not-a-login-account",
        role: "OPERATOR",
        tenantId,
      },
    });
    const [inputProduct, outputProduct] = await Promise.all([
      prisma.product.create({
        data: {
          code: `GB-${suffix}`,
          name: "E2E Green Bean",
          type: "GREEN_BEAN",
          stockKg: 10,
          tenantId,
        },
      }),
      prisma.product.create({
        data: {
          code: `RB-${suffix}`,
          name: "E2E Roasted Bean",
          type: "ROASTED_BEAN",
          tenantId,
        },
      }),
    ]);
    const parent = await prisma.parentRoastingBatch.create({
      data: {
        code: `PRST-${suffix}`,
        inputProductId: inputProduct.id,
        outputProductId: outputProduct.id,
        targetWeightKg: 1,
        status: "PENDING",
        createdById: user.id,
        tenantId,
      },
    });
    const body = {
      event: "DROP",
      event_id: `DROP-${suffix}`,
      parent_batch_id: parent.id,
      machine_id: "E2E-MACHINE",
      timestamp: new Date().toISOString(),
      metrics: {
        duration_seconds: 720,
        drop_temperature: 205.5,
      },
    };

    const first = await request.post("/api/webhooks/artisan", {
      headers: { Authorization: `Bearer ${token}` },
      data: body,
    });
    expect(first.status()).toBe(200);
    expect((await first.json()).parentBatchId).toBe(parent.id);

    const replay = await request.post("/api/webhooks/artisan", {
      headers: { Authorization: `Bearer ${token}` },
      data: body,
    });
    expect(replay.status()).toBe(200);
    expect((await replay.json()).duplicate).toBe(true);

    const children = await prisma.childRoastingBatch.findMany({
      where: { parentId: parent.id },
    });
    expect(children).toHaveLength(1);
    expect(children[0].roastDuration).toBe(720);
    expect(Number(children[0].dropTemp)).toBe(205.5);
  } finally {
    await prisma.webhookEvent.deleteMany({ where: { tenantId } });
    await prisma.childRoastingBatch.deleteMany({
      where: { parent: { tenantId } },
    });
    await prisma.parentRoastingBatch.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }
});

test("public checkout trusts server price and supports verified partial payment", async ({ request, context, page }) => {
  test.setTimeout(180_000);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tenantId = `e2e-checkout-${suffix}`;
  const subdomain = `e2e-checkout-${suffix}`;
  let proofObjectPath: string | null = null;

  try {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        code: `E2E-CHK-${suffix}`,
        name: "E2E Checkout Tenant",
        subdomain,
        subscriptionTier: "PRO",
        subscriptionStatus: "ACTIVE",
        setupCompletedAt: new Date(),
      },
    });
    const user = await prisma.user.create({
      data: {
        name: "E2E Checkout Owner",
        email: `e2e-checkout-${suffix}@example.invalid`,
        password: "not-a-login-account",
        role: "OWNER",
        tenantId,
      },
    });
    const product = await prisma.product.create({
      data: {
        code: `FG-${suffix}`,
        name: "E2E Coffee 250g",
        type: "FINISHED_GOODS",
        price: 50_000,
        stockUnit: 3,
        tenantId,
      },
    });
    await prisma.inventoryLedger.create({
      data: {
        productId: product.id,
        entryType: "IN",
        refType: "ADJUSTMENT_IN",
        refId: `E2E-STOCK-${suffix}`,
        quantityUnit: 3,
        notes: "E2E checkout stock",
        createdById: user.id,
        tenantId,
      },
    });
    const paymentMethod = await prisma.tenantPaymentMethod.create({
      data: {
        tenantId,
        provider: "MANUAL",
        method: "TRANSFER",
        label: "E2E Bank",
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolder: "E2E Checkout Tenant",
      },
    });

    const checkoutBody = {
      customerName: "E2E Buyer",
      customerPhone: `62812${Date.now().toString().slice(-8)}`,
      customerEmail: "",
      customerAddress: "E2E Test Address",
      shippingMethod: "PICKUP",
      paymentMethodId: paymentMethod.id,
      items: [{
        productId: product.id,
        quantity: 2,
        unitPrice: 1,
        price: 1,
      }],
    };
    const first = await request.post(`/api/tenant/${subdomain}/checkout`, {
      data: checkoutBody,
    });
    const firstBody = await first.json();
    expect(first.status(), JSON.stringify(firstBody)).toBe(200);
    expect(firstBody.success).toBe(true);
    expect(firstBody.orderUrl).toMatch(new RegExp(`/tenant/${subdomain}/order/`));

    const invoice = await prisma.invoice.findUnique({
      where: { id: firstBody.invoice.id },
      include: { items: true },
    });
    expect(Number(invoice?.grandTotal)).toBe(100_000);
    expect(Number(invoice?.items[0].unitPrice)).toBe(50_000);
    expect(invoice?.items[0].quantity).toBe(2);

    const submission = await prisma.paymentSubmission.findFirstOrThrow({ where: { tenantId } });
    expect(submission.status).toBe("AWAITING_PROOF");
    expect(submission.paymentId).toBeNull();
    const proof = await request.post(`/api/tenant/${subdomain}/payments/${submission.publicToken}/submit`, {
      multipart: {
        payerName: "E2E Buyer",
        declaredAmount: "40000",
        reference: "E2E-TRANSFER-REF",
        file: {
          name: "proof.png",
          mimeType: "image/png",
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        },
      },
    });
    const proofBody = await proof.json();
    expect(proof.status(), JSON.stringify(proofBody)).toBe(200);
    const submitted = await prisma.paymentSubmission.findUniqueOrThrow({ where: { id: submission.id } });
    proofObjectPath = submitted.proofObjectPath;
    expect(submitted.status).toBe("AWAITING_VERIFICATION");
    expect(Number(submitted.declaredAmount)).toBe(40_000);
    expect(submitted.proofSha256).toHaveLength(64);
    expect(await prisma.payment.count({ where: { tenantId } })).toBe(0);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice!.id } })).status).toBe("ISSUED");

    const sessionCookie = await sealData(
      { user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId } },
      { password: SESSION_OPTIONS.password, ttl: SESSION_OPTIONS.cookieOptions.maxAge },
    );
    await context.addCookies([{ name: SESSION_OPTIONS.cookieName, value: sessionCookie, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/penjualan/pembayaran");
    const reviewCard = page.getByRole("article").filter({ hasText: invoice!.code });
    await expect(reviewCard).toBeVisible();
    await expect(reviewCard.getByText("Nominal berbeda")).toBeVisible();
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      reviewCard.getByRole("button", { name: "Verifikasi" }).click(),
    ]);
    await expect.poll(() => prisma.payment.count({ where: { tenantId } }), { timeout: 15_000 }).toBe(1);
    await expect(page.getByText("Perlu dicek (0)", { exact: true })).toBeVisible();

    const partialInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice!.id } });
    expect(partialInvoice.status).toBe("PARTIAL");
    expect(Number(partialInvoice.paidAmount)).toBe(40_000);
    expect(await prisma.payment.count({ where: { tenantId } })).toBe(1);
    const nextSubmission = await prisma.paymentSubmission.findFirstOrThrow({
      where: { tenantId, invoiceId: invoice!.id, status: "AWAITING_PROOF" },
      orderBy: { createdAt: "desc" },
    });
    expect(Number(nextSubmission.amount)).toBe(60_000);
    await page.goto(firstBody.orderUrl);
    await expect(page.getByRole("link", { name: "Bayar sisa tagihan" })).toHaveAttribute("href", `/tenant/${subdomain}/order/${nextSubmission.publicToken}`);

    const productAfter = await prisma.product.findUnique({
      where: { id: product.id },
      select: { stockUnit: true },
    });
    expect(productAfter?.stockUnit).toBe(3);
    const activeReservation = await prisma.stockReservation.aggregate({
      where: { tenantId, productId: product.id, status: "ACTIVE" },
      _sum: { quantity: true },
    });
    expect(activeReservation._sum.quantity).toBe(2);

    const backorder = await request.post(`/api/tenant/${subdomain}/checkout`, {
      data: checkoutBody,
    });
    const backorderBody = await backorder.json();
    expect(backorder.status(), JSON.stringify(backorderBody)).toBe(200);
    const backorderInvoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: backorderBody.invoice.id },
    });
    expect(backorderInvoice.fulfillmentStatus).toBe("NEEDS_PRODUCTION");
    const fulfillmentTask = await prisma.fulfillmentTask.findFirstOrThrow({
      where: { tenantId, invoiceId: backorderInvoice.id, productId: product.id },
    });
    expect(fulfillmentTask.reservedQuantity).toBe(1);
    expect(fulfillmentTask.shortageQuantity).toBe(1);
    expect(await prisma.invoice.count({ where: { tenantId } })).toBe(2);
  } finally {
    if (proofObjectPath) {
      await unlink(path.join(process.cwd(), ".data", "private-uploads", ...proofObjectPath.split("/"))).catch(() => undefined);
    }
    await prisma.rateLimitBucket.deleteMany({
      where: { OR: [
        { key: { startsWith: `tenant-checkout:${subdomain}:` } },
        { key: { startsWith: `payment-proof:${subdomain}:` } },
      ] },
    });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId } } });
    await prisma.journalEntry.deleteMany({ where: { tenantId } });
    await prisma.account.deleteMany({ where: { tenantId } });
    await prisma.inventoryLedger.deleteMany({ where: { tenantId } });
    await prisma.paymentSubmission.deleteMany({ where: { tenantId } });
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.tenantPaymentMethod.deleteMany({ where: { tenantId } });
    await prisma.invoiceItem.deleteMany({
      where: { invoice: { tenantId } },
    });
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }
});
