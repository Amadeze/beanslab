const fs = require('fs');

const path = "F:/Roastery Operating System/ros-app/src/app/(dashboard)/laporan/actions.ts";
let content = fs.readFileSync(path, 'utf8');

const oldBs = `    trackingNote: payablePurchases.length > 0
        ? \`\${payablePurchases.length} pembelian supplier masih memiliki saldo hutang.\`
        : "Tidak ada hutang supplier aktif.",`;

const newBs = `    trackingNote: unpaidCount > 0
        ? \`\${unpaidCount} dari \${payablePurchases.length} pembelian supplier masih memiliki saldo hutang.\`
        : "Semua tagihan pembelian supplier telah lunas.",`;

const oldBsCount = `    overdue31To60: 0,
    overdue61Plus: 0,
  };
  for (const purchase of payablePurchases) {
    const paid = purchase.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const balance = Math.max(0, Number(purchase.totalCost) - paid);
    if (balance <= 0.01) continue;`;

const newBsCount = `    overdue31To60: 0,
    overdue61Plus: 0,
  };
  let unpaidCount = 0;
  for (const purchase of payablePurchases) {
    const paid = purchase.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const balance = Math.max(0, Number(purchase.totalCost) - paid);
    if (balance <= 0.01) continue;
    unpaidCount++;`;

content = content.replace(oldBsCount, newBsCount);
content = content.replace(oldBs, newBs);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully patched laporan/actions.ts part 4 trackingNote");
