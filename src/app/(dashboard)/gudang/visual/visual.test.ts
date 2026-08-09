import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getCurrentTenantId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisualWarehouseMap } from "./actions";
import { scanLocation } from "../scan/actions";
import { summarizeLotInventory } from "@/lib/lot";
import { encodeLocationQr, encodeLotQr, parseQrPayload } from "@/lib/qr";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  getCurrentTenantId: vi.fn(),
  getSystemUserId: vi.fn(),
  requireTenantPrisma: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/qr", () => ({
  generateQrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
  encodeLocationQr: vi.fn((code: string) => JSON.stringify({ type: "LOCATION", code })),
  encodeLotQr: vi.fn((batchCode: string) => JSON.stringify({ type: "LOT", batchCode })),
  parseQrPayload: vi.fn((raw: string) => {
    try {
      const p = JSON.parse(raw);
      if (p?.type === "LOCATION") return { type: "LOCATION", code: p.code };
      if (p?.type === "LOT") return { type: "LOT", batchCode: p.batchCode };
    } catch {}
    return { type: "RAW", code: raw };
  }),
}));

describe("visual warehouse map", () => {
  beforeEach(() => {
    vi.mocked(getCurrentTenantId).mockResolvedValue("tenant-1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives rack groups from zone field, falling back to code prefix", async () => {
    const mockLocations = [
      { id: "loc-1", code: "A-01", name: "Rak A Bin 01", zone: "DRY", isActive: true, isDefault: true, placements: [] },
      { id: "loc-2", code: "B-02", name: "Rak B Bin 02", zone: null, isActive: true, isDefault: false, placements: [] },
      { id: "loc-3", code: "C-03", name: "Rak C Bin 03", zone: null, isActive: true, isDefault: false, placements: [] },
    ];

    prisma.warehouse.findMany = vi.fn().mockResolvedValue([
      { id: "wh-1", code: "WH-01", name: "Gudang Utama", address: null, isActive: true, isDefault: true, locations: mockLocations },
    ]);

    const result = await getVisualWarehouseMap();
    const wh = result.warehouses[0];

    expect(wh.rackGroups).toHaveProperty("DRY");
    expect(wh.rackGroups).toHaveProperty("B");
    expect(wh.rackGroups).toHaveProperty("C");

    expect(wh.rackGroups["DRY"][0].code).toBe("A-01");
    expect(wh.rackGroups["B"][0].code).toBe("B-02");
    expect(wh.rackGroups["C"][0].code).toBe("C-03");
  });

  it("scopes locations to the current tenant", async () => {
    const mockLocations = [
      { id: "loc-t1", code: "A-01", name: "Rak A", zone: "DRY", isActive: true, isDefault: true, placements: [] },
    ];

    prisma.warehouse.findMany = vi.fn().mockResolvedValue([
      { id: "wh-1", code: "WH-01", name: "Gudang Utama", address: null, isActive: true, isDefault: true, locations: mockLocations },
    ]);

    const result = await getVisualWarehouseMap();

    const callArgs = (prisma.warehouse.findMany as any).mock.calls[0][0];
    expect(callArgs.where.tenantId).toBe("tenant-1");

    expect(result.warehouses[0].rackGroups["DRY"][0].id).toBe("loc-t1");
  });

  it("excludes inactive locations via Prisma filter", async () => {
    const mockLocations = [
      { id: "loc-active", code: "A-01", name: "Active", zone: "DRY", isActive: true, isDefault: true, placements: [] },
      { id: "loc-inactive", code: "A-02", name: "Inactive", zone: "DRY", isActive: false, isDefault: false, placements: [] },
    ];

    prisma.warehouse.findMany = vi.fn().mockResolvedValue([
      { id: "wh-1", code: "WH-01", name: "Gudang", address: null, isActive: true, isDefault: true, locations: mockLocations },
    ]);

    await getVisualWarehouseMap();

    const callArgs = (prisma.warehouse.findMany as any).mock.calls[0][0];
    expect(callArgs.where.tenantId).toBe("tenant-1");
    expect(callArgs.include.locations.where.isActive).toBe(true);
  });

  it("marks locations with expired-lot warnings", async () => {
    const pastDate = new Date(Date.now() - 10 * 86_400_000);
    const mockLocations = [
      {
        id: "loc-1",
        code: "A-01",
        name: "Rak A",
        zone: "DRY",
        isActive: true,
        isDefault: true,
        placements: [
          {
            lotId: "lot-1",
            quantityKg: 10,
            quantityUnit: 0,
            supplyQty: 0,
            lot: {
              batchCode: "LOT-01",
              productId: "prod-1",
              packagingId: null,
              supplyItemId: null,
              expiryDate: pastDate,
              quantityKg: 100,
              quantityUnit: 0,
              supplyQuantity: 0,
              product: { name: "Green Bean" },
              packaging: null,
              supplyItem: null,
              supplier: { name: "Supplier A" },
            },
          },
        ],
      },
    ];

    prisma.warehouse.findMany = vi.fn().mockResolvedValue([
      { id: "wh-1", code: "WH-01", name: "Gudang", address: null, isActive: true, isDefault: true, locations: mockLocations },
    ]);

    const result = await getVisualWarehouseMap();
    const loc = result.warehouses[0].rackGroups["DRY"][0];
    expect(loc.hasExpiryWarning).toBe(true);
    expect(loc.lotCount).toBe(1);
    expect(loc.totalKg).toBe(10);
  });

  it("computes correct total quantities per location", async () => {
    const mockLocations = [
      {
        id: "loc-1",
        code: "A-01",
        name: "Rak A",
        zone: "DRY",
        isActive: true,
        isDefault: true,
        placements: [
          {
            lotId: "lot-1",
            quantityKg: 40,
            quantityUnit: 0,
            supplyQty: 0,
            lot: {
              batchCode: "LOT-01",
              productId: "prod-1",
              packagingId: null,
              supplyItemId: null,
              expiryDate: null,
              quantityKg: 50,
              quantityUnit: 0,
              supplyQuantity: 0,
              product: { name: "Green Bean" },
              packaging: null,
              supplyItem: null,
              supplier: { name: "Supplier A" },
            },
          },
          {
            lotId: "lot-2",
            quantityKg: 30.5,
            quantityUnit: 0,
            supplyQty: 0,
            lot: {
              batchCode: "LOT-02",
              productId: "prod-1",
              packagingId: null,
              supplyItemId: null,
              expiryDate: null,
              quantityKg: 40,
              quantityUnit: 0,
              supplyQuantity: 0,
              product: { name: "Green Bean" },
              packaging: null,
              supplyItem: null,
              supplier: { name: "Supplier B" },
            },
          },
        ],
      },
    ];

    prisma.warehouse.findMany = vi.fn().mockResolvedValue([
      { id: "wh-1", code: "WH-01", name: "Gudang", address: null, isActive: true, isDefault: true, locations: mockLocations },
    ]);

    const result = await getVisualWarehouseMap();
    const loc = result.warehouses[0].rackGroups["DRY"][0];
    expect(loc.totalKg).toBe(70.5);
    expect(loc.lotCount).toBe(2);
  });

  it("cross-tenant access blocked: warehouse.findMany includes tenantId filter", async () => {
    vi.mocked(getCurrentTenantId).mockResolvedValue("tenant-A");

    const mockLocations = [
      { id: "loc-1", code: "A-01", name: "Rak A", zone: "DRY", isActive: true, isDefault: true, placements: [] },
    ];

    prisma.warehouse.findMany = vi.fn().mockResolvedValue([
      { id: "wh-1", code: "WH-01", name: "Gudang A", address: null, isActive: true, isDefault: true, locations: mockLocations },
    ]);

    const result = await getVisualWarehouseMap();

    const callArgs = (prisma.warehouse.findMany as any).mock.calls[0][0];
    expect(callArgs.where.tenantId).toBe("tenant-A");
    expect(result.warehouses).toHaveLength(1);
    expect(result.warehouses[0].id).toBe("wh-1");
  });

  it("handles location with no placements (empty state)", async () => {
    const mockLocations = [
      { id: "loc-1", code: "A-01", name: "Rak A", zone: "DRY", isActive: true, isDefault: true, placements: [] },
    ];

    prisma.warehouse.findMany = vi.fn().mockResolvedValue([
      { id: "wh-1", code: "WH-01", name: "Gudang", address: null, isActive: true, isDefault: true, locations: mockLocations },
    ]);

    const result = await getVisualWarehouseMap();
    const loc = result.warehouses[0].rackGroups["DRY"][0];
    expect(loc.lotCount).toBe(0);
    expect(loc.totalKg).toBe(0);
    expect(loc.placements).toHaveLength(0);
    expect(loc.hasExpiryWarning).toBe(false);
  });
});

describe("location contents tenant isolation", () => {
  beforeEach(() => {
    vi.mocked(getCurrentTenantId).mockResolvedValue("tenant-1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scanLocation only returns placements from the current tenant", async () => {
    prisma.location.findFirst = vi.fn().mockResolvedValue({
      id: "loc-1",
      code: "A-01",
      name: "Rak A",
      zone: "DRY",
      isActive: true,
      isDefault: true,
      warehouse: { name: "Gudang", code: "WH-01" },
    });

    prisma.lotPlacement.findMany = vi.fn().mockResolvedValue([
      {
        lotId: "lot-1",
        quantityKg: 10,
        quantityUnit: 0,
        supplyQty: 0,
        lot: {
          batchCode: "LOT-01",
          productId: "prod-1",
          packagingId: null,
          supplyItemId: null,
          expiryDate: null,
          product: { name: "Green Bean" },
          packaging: null,
          supplyItem: null,
          supplier: { name: "S1" },
        },
        locationId: "loc-1",
      },
    ]);

    const res = await scanLocation("A-01");

    expect(res.success).toBe(true);
    expect(res.data?.placements).toHaveLength(1);

    const locCall = (prisma.location.findFirst as any).mock.calls[0][0];
    expect(locCall.where.tenantId).toBe("tenant-1");

    const placementCall = (prisma.lotPlacement.findMany as any).mock.calls[0][0];
    expect(placementCall.where.tenantId).toBe("tenant-1");
    expect(placementCall.where.locationId).toBe("loc-1");
  });

  it("scanLocation rejects a non-existent location code", async () => {
    prisma.location.findFirst = vi.fn().mockResolvedValue(null);

    const res = await scanLocation("NONEXISTENT");
    expect(res.success).toBe(false);
    expect(res.error).toContain("tidak ditemukan");
  });
});

describe("lot distribution totals", () => {
  it("summarizeLotInventory returns correct remaining when ledger entries exist", () => {
    const result = summarizeLotInventory({
      originalKg: 100,
      originalUnit: 0,
      ledgers: [
        { entryType: "IN", quantityKg: 100, quantityUnit: null },
        { entryType: "OUT", quantityKg: 30, quantityUnit: null },
        { entryType: "OUT", quantityKg: 20.5, quantityUnit: null },
      ],
      expiryDate: null,
      consumedAt: null,
    });

    expect(result.remainingKg).toBe(49.5);
    expect(result.status).toBe("ok");
  });

  it("marks lot as consumed when remaining reaches zero", () => {
    const result = summarizeLotInventory({
      originalKg: 100,
      originalUnit: 0,
      ledgers: [
        { entryType: "IN", quantityKg: 100, quantityUnit: null },
        { entryType: "OUT", quantityKg: 100, quantityUnit: null },
      ],
      expiryDate: null,
      consumedAt: new Date(),
    });

    expect(result.status).toBe("consumed");
  });

  it("marks lot as expired when expiry date is in the past", () => {
    const result = summarizeLotInventory({
      originalKg: 100,
      originalUnit: 0,
      ledgers: [{ entryType: "IN", quantityKg: 100, quantityUnit: null }],
      expiryDate: new Date(Date.now() - 86_400_000),
      consumedAt: null,
    });

    expect(result.status).toBe("expired");
  });
});

describe("QR code generation", () => {
  it("encodeLocationQr produces a JSON payload with type=LOCATION", () => {
    const qr = encodeLocationQr("A-01");
    expect(qr).toBe(JSON.stringify({ type: "LOCATION", code: "A-01" }));
  });

  it("encodeLotQr produces a JSON payload with type=LOT", () => {
    const qr = encodeLotQr("LOT-2408");
    expect(qr).toBe(JSON.stringify({ type: "LOT", batchCode: "LOT-2408" }));
  });

  it("parseQrPayload correctly distinguishes location vs lot vs raw", () => {
    const locResult = parseQrPayload(encodeLocationQr("B-02"));
    expect(locResult.type).toBe("LOCATION");
    expect((locResult as any).code).toBe("B-02");

    const lotResult = parseQrPayload(encodeLotQr("LOT-99"));
    expect(lotResult.type).toBe("LOT");
    expect((lotResult as any).batchCode).toBe("LOT-99");

    const rawResult = parseQrPayload("just-some-text");
    expect(rawResult.type).toBe("RAW");
    expect((rawResult as any).code).toBe("just-some-text");
  });
});
