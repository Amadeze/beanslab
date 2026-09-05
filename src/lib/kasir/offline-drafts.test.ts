import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  createDraftId,
  deleteOfflineDraft,
  draftSubtotal,
  loadOfflineDrafts,
  saveOfflineDraft,
  type OfflineDraft,
} from "./offline-drafts";

function buildSample(): OfflineDraft {
  return {
    id: "draft-1",
    createdAt: new Date("2026-09-03T00:00:00Z").toISOString(),
    customerName: "Kopi Senja",
    items: [
      { productId: "p1", productName: "Ethiopia 250g", quantity: 2, unitPrice: 110_000 },
      { productId: "p2", productName: "Espresso 1kg", quantity: 1, unitPrice: 240_000 },
    ],
    notes: "",
    paymentMethod: "CASH",
  };
}

describe("offline-drafts (in-memory localStorage shim)", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => store.clear(),
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
          return store.size;
        },
      },
    });
    vi.stubGlobal("crypto", undefined);
  });

  it("round-trips a draft", () => {
    const draft = buildSample();
    saveOfflineDraft(draft);
    const all = loadOfflineDrafts();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("draft-1");
    expect(all[0].items).toHaveLength(2);
  });

  it("updates an existing draft by id", () => {
    const draft = buildSample();
    saveOfflineDraft(draft);
    saveOfflineDraft({ ...draft, customerName: "Updated" });
    const all = loadOfflineDrafts();
    expect(all).toHaveLength(1);
    expect(all[0].customerName).toBe("Updated");
  });

  it("deletes a draft by id", () => {
    saveOfflineDraft(buildSample());
    deleteOfflineDraft("draft-1");
    expect(loadOfflineDrafts()).toHaveLength(0);
  });

  it("ignores malformed entries on read", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => JSON.stringify([{ id: 123 }, null, { not: "a draft" }, buildSample()]),
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        get length() {
          return 0;
        },
      },
    });
    const all = loadOfflineDrafts();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("draft-1");
  });

  it("returns an empty array when localStorage is missing", () => {
    vi.stubGlobal("window", undefined);
    expect(loadOfflineDrafts()).toEqual([]);
  });

  it("createDraftId produces a string and tolerates missing crypto", () => {
    const id = createDraftId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(4);
  });

  it("draftSubtotal sums quantity * unitPrice", () => {
    const total = draftSubtotal(buildSample());
    expect(total).toBe(2 * 110_000 + 1 * 240_000);
  });
});