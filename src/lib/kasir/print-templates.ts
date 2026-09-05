export type PrinterTemplate = "thermal-58" | "thermal-80" | "a4-invoice";

export interface PrintableInvoiceItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface PrintableInvoice {
  code: string;
  date: Date;
  customerName: string;
  sellerName: string;
  sellerAddress?: string | null;
  sellerPhone?: string | null;
  items: PrintableInvoiceItem[];
  subtotal: number;
  tax: number;
  grandTotal: number;
  notes?: string | null;
  paymentMethod?: string | null;
  cashierName?: string | null;
}

const IDR = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (date: Date) =>
  date.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderItemRow(item: PrintableInvoiceItem, columns: 2 | 3 | 4): string {
  const safeName = escapeHtml(item.name);
  if (columns === 2) {
    return `<tr><td>${safeName}<br/><span class="muted">${item.quantity} ${escapeHtml(item.unit)} × ${IDR(item.unitPrice)}</span></td><td class="num">${IDR(item.total)}</td></tr>`;
  }
  if (columns === 3) {
    return `<tr><td>${safeName}</td><td class="num">${item.quantity} ${escapeHtml(item.unit)}</td><td class="num">${IDR(item.total)}</td></tr>`;
  }
  return `<tr><td>${safeName}</td><td class="num">${item.quantity}</td><td class="num">${IDR(item.unitPrice)}</td><td class="num">${IDR(item.total)}</td></tr>`;
}

function renderHeader(invoice: PrintableInvoice): string {
  const sellerAddress = invoice.sellerAddress ? `<div class="muted">${escapeHtml(invoice.sellerAddress)}</div>` : "";
  const sellerPhone = invoice.sellerPhone ? `<div class="muted">${escapeHtml(invoice.sellerPhone)}</div>` : "";
  return `
    <header>
      <h1>${escapeHtml(invoice.sellerName)}</h1>
      ${sellerAddress}
      ${sellerPhone}
      <div class="meta">
        <div><span class="muted">No.</span> <b>${escapeHtml(invoice.code)}</b></div>
        <div><span class="muted">Tanggal</span> ${formatDate(invoice.date)}</div>
        <div><span class="muted">Pelanggan</span> ${escapeHtml(invoice.customerName)}</div>
        ${invoice.cashierName ? `<div><span class="muted">Kasir</span> ${escapeHtml(invoice.cashierName)}</div>` : ""}
        ${invoice.paymentMethod ? `<div><span class="muted">Bayar</span> ${escapeHtml(invoice.paymentMethod)}</div>` : ""}
      </div>
    </header>
  `;
}

function renderTotals(invoice: PrintableInvoice, columns: 2 | 3 | 4): string {
  if (columns === 2) {
    return `
      <section class="totals">
        <div><span>Subtotal</span><span class="num">${IDR(invoice.subtotal)}</span></div>
        ${invoice.tax > 0 ? `<div><span>Pajak</span><span class="num">${IDR(invoice.tax)}</span></div>` : ""}
        <div class="grand"><span>Total</span><span class="num">${IDR(invoice.grandTotal)}</span></div>
      </section>
    `;
  }
  return `
    <table class="totals">
      <tbody>
        <tr><td>Subtotal</td><td class="num">${IDR(invoice.subtotal)}</td></tr>
        ${invoice.tax > 0 ? `<tr><td>Pajak</td><td class="num">${IDR(invoice.tax)}</td></tr>` : ""}
        <tr class="grand"><td><b>Total</b></td><td class="num"><b>${IDR(invoice.grandTotal)}</b></td></tr>
      </tbody>
    </table>
  `;
}

const SHARED_CSS = `
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #000; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 6px; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .muted { color: #555; }
  header h1 { margin: 0 0 4px; font-size: 1.1em; }
  .meta div { display: flex; justify-content: space-between; gap: 8px; }
  footer { margin-top: 12px; font-size: 0.9em; }
  .totals { margin-top: 8px; }
  .totals .grand { font-weight: bold; }
  @media print { body { margin: 0; } .no-print { display: none; } }
`;

function renderThermal58(invoice: PrintableInvoice): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(invoice.code)}</title>
<style>${SHARED_CSS} @page { size: 58mm auto; margin: 4mm; } body { font-size: 11px; }</style>
</head><body>
${renderHeader(invoice)}
<table>
  <tbody>${invoice.items.map((item) => renderItemRow(item, 2)).join("")}</tbody>
</table>
${renderTotals(invoice, 2)}
${invoice.notes ? `<footer>${escapeHtml(invoice.notes)}</footer>` : ""}
</body></html>`;
}

function renderThermal80(invoice: PrintableInvoice): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(invoice.code)}</title>
<style>${SHARED_CSS} @page { size: 80mm auto; margin: 5mm; } body { font-size: 12px; }</style>
</head><body>
${renderHeader(invoice)}
<table>
  <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Total</th></tr></thead>
  <tbody>${invoice.items.map((item) => renderItemRow(item, 3)).join("")}</tbody>
</table>
${renderTotals(invoice, 3)}
${invoice.notes ? `<footer>${escapeHtml(invoice.notes)}</footer>` : ""}
</body></html>`;
}

function renderA4(invoice: PrintableInvoice): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(invoice.code)}</title>
<style>${SHARED_CSS} @page { size: A4; margin: 16mm; } body { font-size: 13px; } header h1 { font-size: 1.4em; }</style>
</head><body>
${renderHeader(invoice)}
<table>
  <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Total</th></tr></thead>
  <tbody>${invoice.items.map((item) => renderItemRow(item, 4)).join("")}</tbody>
</table>
${renderTotals(invoice, 4)}
${invoice.notes ? `<footer><b>Catatan:</b><br/>${escapeHtml(invoice.notes)}</footer>` : ""}
</body></html>`;
}

const RENDERERS: Record<PrinterTemplate, (invoice: PrintableInvoice) => string> = {
  "thermal-58": renderThermal58,
  "thermal-80": renderThermal80,
  "a4-invoice": renderA4,
};

export function renderPrintableInvoice(
  invoice: PrintableInvoice,
  template: PrinterTemplate,
): string {
  return RENDERERS[template](invoice);
}

export const PRINTER_TEMPLATE_LABELS: Record<PrinterTemplate, string> = {
  "thermal-58": "Thermal 58mm",
  "thermal-80": "Thermal 80mm",
  "a4-invoice": "A4 (invoice)",
};