import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "C:\\Users\\it.BW\\AppData\\Local\\Temp\\opencode\\spot-shots";
const results = [];
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
try {
  const owner = await prisma.user.findFirst({
    where: { isActive: true, role: { in: ["OWNER", "SUPERADMIN"] } },
    select: { id: true, name: true, email: true, role: true, tenantId: true },
  });
  if (!owner) {
    console.log("SKIP no owner in DB");
    process.exit(0);
  }
  const cookie = await sealData(
    { user: { ...owner, sessionVersion: 0 } },
    { password: process.env.SESSION_SECRET, ttl: 60 * 60 * 8 },
  );
  await context.addCookies([
    { name: "ros_session", value: cookie, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE-ERR:", m.text().slice(0, 200)); });

  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const rail = page.locator('[data-testid="operating-stage-rail"] a');
  check("rail 6 links", (await rail.count()) === 6, `count=${await rail.count()}`);
  const labels = await rail.allTextContents();
  check("rail order", JSON.stringify(labels.map((t) => t.trim())) === JSON.stringify(["Pasokan & Stok", "Gudang & Lokasi", "Roasting", "Produksi", "Penjualan", "Kas & Piutang"]), labels.map((t) => t.trim()).join(","));
  check("ail tahap 01-06", (await page.locator('[data-testid="operating-stage-rail"] [aria-label^="Tahap "]').count()) === 6);
  check("SYS counter", await page.getByText(/SYS 01 \/ 06/).isVisible().catch(() => false));
  check("gudang rail active", await page.locator('[data-testid="operating-stage-rail"] a[aria-current="step"]').getByText("Pasokan & Stok").isVisible().catch(() => false));
  await page.screenshot({ path: path.join(SHOTS, "inventory.png"), fullPage: true });

  await page.goto(`${BASE}/gudang`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check("gudang active tahap 02", await page.locator('[data-testid="operating-stage-rail"] a[aria-current="step"]').getByText("Gudang & Lokasi").isVisible().catch(() => false));
  check("gudang SYS 02/06", await page.getByText(/SYS 02 \/ 06/).isVisible().catch(() => false));

  await page.goto(`${BASE}/keuangan?tab=pembelian`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const pembelianTab = page.getByRole("tab", { name: /^Pembelian/ });
  check("keuangan tab=pembelian active", await pembelianTab.getAttribute("aria-selected").then((v) => v === "true").catch(() => false));

  await page.goto(`${BASE}/laporan/akuntansi`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("akuntansi super-tab", await page.getByRole("tab", { name: "Akuntansi" }).isVisible().catch(() => false));
  const subTabs = await page.locator('[data-testid="report-tabs"]').count();
  check("akuntansi page renders", (await page.getByRole("heading", { name: "Akuntansi" }).count()) > 0);
  await page.screenshot({ path: path.join(SHOTS, "akuntansi.png"), fullPage: true });

  await page.goto(`${BASE}/laporan/akuntansi/arus-kas`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("arus-kas live (ReportLayout)", await page.getByRole("tab", { name: "Arus Kas" }).isVisible().catch(() => false));

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const pipelineLabels = await page.locator('[data-testid="compact-dashboard-header"] a').allTextContents();
  check("dashboard 6-stage pipeline", pipelineLabels.some((t) => t.includes("Gudang")), pipelineLabels.length + " cells");
  await page.screenshot({ path: path.join(SHOTS, "dashboard.png"), fullPage: true });
} finally {
  await browser.close();
  await prisma.$disconnect();
  console.log(results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL"));
  console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
}