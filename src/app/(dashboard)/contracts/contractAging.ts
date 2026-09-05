export interface AgingInvoice {
  outstanding: number;
  dueDate: Date | null;
}

export interface AgingBuckets {
  current: number;
  d1to30: number;
  d31to60: number;
  d61to90: number;
  over90: number;
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

export function bucketAging(invoices: AgingInvoice[], now: Date): AgingBuckets {
  const result: AgingBuckets = { current: 0, d1to30: 0, d31to60: 0, d61to90: 0, over90: 0 };
  for (const invoice of invoices) {
    if (invoice.outstanding <= 0.01) continue;
    const overdue = invoice.dueDate ? daysBetween(invoice.dueDate, now) : 0;
    if (overdue <= 0) result.current += invoice.outstanding;
    else if (overdue <= 30) result.d1to30 += invoice.outstanding;
    else if (overdue <= 60) result.d31to60 += invoice.outstanding;
    else if (overdue <= 90) result.d61to90 += invoice.outstanding;
    else result.over90 += invoice.outstanding;
  }
  return result;
}