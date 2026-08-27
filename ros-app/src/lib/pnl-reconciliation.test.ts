import { describe, expect, it } from "vitest";
import { reconciliationWarning } from "./pnl-reconciliation";

describe("reconciliationWarning (banner P&L)", () => {
  it("tidak menampilkan banner saat selisih ≤ 0.01 (termasuk 0)", () => {
    expect(reconciliationWarning(0)).toBeNull();
    expect(reconciliationWarning(0.005)).toBeNull();
    expect(reconciliationWarning(-0.01)).toBeNull();
  });

  it("menampilkan peringatan saat selisih > 0.01", () => {
    expect(reconciliationWarning(15_000)).toBe(
      "Perlu Pemeriksaan: rincian pendapatan berbeda 15.000 dari buku besar periode ini",
    );
    expect(reconciliationWarning(-15_000)).not.toBeNull();
  });

  it("tidak membocorkan detail internal (mis. timezone)", () => {
    const message = reconciliationWarning(100);
    expect(message).not.toMatch(/periode Asia/);
    expect(message).toContain("buku besar");
  });
});