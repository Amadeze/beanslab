import { PageHeader } from "@/components/layout/PageHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { PaymentReviewClient } from "./PaymentReviewClient";

export const dynamic = "force-dynamic";

export default async function PaymentReviewPage() {
  await requireRole("OWNER", "MANAGER", "CASHIER");
  const tp = await requireTenantPrisma();
  const rows = await tp.paymentSubmission.findMany({
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      status: true,
      method: true,
      amount: true,
      declaredAmount: true,
      reviewedAmount: true,
      payerName: true,
      reference: true,
      submittedAt: true,
      rejectionReason: true,
      proofObjectPath: true,
      suspectedDuplicateOf: { select: { id: true, reference: true, invoice: { select: { code: true } } } },
      invoice: { select: { code: true, grandTotal: true, paidAmount: true, customer: { select: { name: true } } } },
    },
  });
  const serialized = rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    declaredAmount: row.declaredAmount ? Number(row.declaredAmount) : null,
    reviewedAmount: row.reviewedAmount ? Number(row.reviewedAmount) : null,
    submittedAt: row.submittedAt?.toISOString() || null,
    invoice: { ...row.invoice, grandTotal: Number(row.invoice.grandTotal), paidAmount: Number(row.invoice.paidAmount) },
  }));
  const pending = serialized.filter((row) => row.status === "AWAITING_VERIFICATION").length;

  return <div className="flex min-h-0 flex-1 flex-col"><PageHeader title="Verifikasi Pembayaran" eyebrow="Penjualan" description={`${pending} bukti menunggu keputusan. Hanya bukti yang disetujui membentuk Payment dan jurnal kas.`} /><WorkspaceNav kind="sales" /><div className="custom-scrollbar flex-1 overflow-auto"><div className="mx-auto max-w-6xl p-4 md:p-6 lg:p-8"><PaymentReviewClient rows={serialized} /></div></div></div>;
}
