export interface OfflineDraftItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OfflineDraft {
  id: string;
  createdAt: string;
  customerName: string;
  items: OfflineDraftItem[];
  notes: string;
  paymentMethod: string;
}

const STORAGE_KEY = "roastd.kasir.drafts";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll(): OfflineDraft[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is OfflineDraft => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.createdAt === "string" &&
        typeof candidate.customerName === "string" &&
        Array.isArray(candidate.items) &&
        typeof candidate.notes === "string" &&
        typeof candidate.paymentMethod === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeAll(drafts: OfflineDraft[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {}
}

export function loadOfflineDrafts(): OfflineDraft[] {
  return readAll();
}

export function loadOfflineDraft(id: string): OfflineDraft | null {
  return readAll().find((draft) => draft.id === id) ?? null;
}

export function saveOfflineDraft(draft: OfflineDraft): void {
  const all = readAll();
  const index = all.findIndex((entry) => entry.id === draft.id);
  if (index >= 0) {
    all[index] = draft;
  } else {
    all.unshift(draft);
  }
  writeAll(all);
}

export function deleteOfflineDraft(id: string): void {
  writeAll(readAll().filter((entry) => entry.id !== id));
}

export function createDraftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function draftSubtotal(draft: OfflineDraft): number {
  return draft.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
}