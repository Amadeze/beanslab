import {
  getCapitalHistory,
  getCapitalSummaryQuick,
  getExpenseHistory,
  getKeuanganPageData,
  getPaymentHistory,
  getPurchaseHistory,
  getSupplierPaymentHistory,
  type VoidHistoryFilter,
} from "./actions";
import { KeuanganClient } from "./_components/KeuanganClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ status?: string }>;
};

function parseVoidFilter(value: string | undefined): VoidHistoryFilter {
  if (value === "VOIDED" || value === "ALL") return value;
  return "ACTIVE";
}

export default async function KeuanganPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const filter = parseVoidFilter(status);
  const [data, expenses, purchases, payments, supplierPayments, capitalTransactions, capitalSummary] = await Promise.all([
    getKeuanganPageData(),
    getExpenseHistory(filter),
    getPurchaseHistory(),
    getPaymentHistory(filter),
    getSupplierPaymentHistory(filter),
    getCapitalHistory(),
    getCapitalSummaryQuick(),
  ]);
  return (
    <KeuanganClient
      data={data}
      expenses={expenses}
      purchases={purchases}
      payments={payments}
      supplierPayments={supplierPayments}
      capitalTransactions={capitalTransactions}
      capitalSummary={capitalSummary}
      historyFilter={filter}
    />
  );
}
