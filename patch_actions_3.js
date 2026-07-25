const fs = require('fs');

const path = "F:/Roastery Operating System/ros-app/src/app/(dashboard)/laporan/actions.ts";
let content = fs.readFileSync(path, 'utf8');

const oldLoop1 = `      let totalPurCost = 0; let totalPurKg = 0;
      for (const pur of p.purchases) {
        totalPurCost += Number(pur.totalCost);
        totalPurKg += Number(pur.weightKg);
      }
      const avgPurchasePrice = totalPurKg > 0 ? totalPurCost / totalPurKg : 0;

      greenBeans.push({
        id: p.id, name: p.name, boughtKg: bought, roastedKg: roasted, adjustmentOutKg: adjOut, currentStockKg: stock,
        avgPurchasePrice
      });`;

const newLoop1 = `      greenBeans.push({
        id: p.id, name: p.name, boughtKg: bought, roastedKg: roasted, adjustmentOutKg: adjOut, currentStockKg: stock,
        avgPurchasePrice: gbPriceMap.get(p.id) ?? 0
      });`;
content = content.replace(oldLoop1, newLoop1);

const oldLoop2 = `      let salesRevenue = 0;
      let cogs = 0;
      // Gunakan HPP dari resep, bukan dari invoice
      const hppPerUnit = recipeHppMap.get(p.id) ?? 0;
      for (const inv of p.invoiceItems) {
        if (
          (inv.invoice.status === "PAID" || inv.invoice.status === "PARTIAL" || inv.invoice.status === "ISSUED")
          && inv.invoice.issuedAt < periodEnd
          && inPeriod(inv.invoice.issuedAt)
        ) {
          salesRevenue += Number(inv.subtotal);
          cogs += hppPerUnit * inv.quantity;
        }
      }`;

const newLoop2 = `      let salesRevenue = 0, cogs = 0;
      const hppPerUnit = recipeHppMap.get(p.id) ?? 0;
      for (const inv of periodInvoices.filter(i => i.productId === p.id)) {
        if (inPeriod(inv.invoice.issuedAt)) {
          salesRevenue += Number(inv.subtotal);
          cogs += hppPerUnit * inv.quantity;
        }
      }`;
content = content.replace(oldLoop2, newLoop2);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully patched laporan/actions.ts part 3 loop");
