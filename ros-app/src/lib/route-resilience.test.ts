import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

describe("route resilience conventions", () => {
  it("keeps recovery boundaries for each major application surface", () => {
    const boundaries = [
      "src/app/global-error.tsx",
      "src/app/error.tsx",
      "src/app/(dashboard)/error.tsx",
      "src/app/superadmin/error.tsx",
      "src/app/tenant/[subdomain]/error.tsx",
    ];

    for (const file of boundaries) {
      const contents = source(file);
      expect(contents, file).toContain('"use client"');
      expect(contents, file).toContain("unstable_retry");
    }

    expect(source("src/app/global-error.tsx")).toContain("<html");
    expect(source("src/app/global-error.tsx")).toContain("<body");
  });

  it("keeps instant loading states on data-heavy routes", () => {
    const loadingStates = [
      "src/app/(dashboard)/dashboard/loading.tsx",
      "src/app/(dashboard)/inventory/loading.tsx",
      "src/app/(dashboard)/roasting/loading.tsx",
      "src/app/(dashboard)/produksi/loading.tsx",
      "src/app/(dashboard)/penjualan/loading.tsx",
      "src/app/(dashboard)/keuangan/loading.tsx",
      "src/app/(dashboard)/laporan/loading.tsx",
      "src/app/(dashboard)/master-data/loading.tsx",
      "src/app/(dashboard)/settings/loading.tsx",
      "src/app/(dashboard)/billing/loading.tsx",
      "src/app/(dashboard)/audit/loading.tsx",
      "src/app/superadmin/dashboard/loading.tsx",
      "src/app/superadmin/tenants/loading.tsx",
      "src/app/tenant/[subdomain]/loading.tsx",
    ];

    for (const file of loadingStates) {
      expect(source(file), file).toMatch(
        /aria-busy|Skeleton|DashboardPageSkeleton|StandardPageLayout|Loader2/,
      );
    }
  });
});
