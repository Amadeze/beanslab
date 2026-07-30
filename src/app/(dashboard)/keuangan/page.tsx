import {
  getCapitalHistory,
  getCapitalSummaryQuick,
  getExpenseHistory,
  getKeuanganPageData,
  getPaymentHistory,
  getPurchaseHistory,
  getSupplierPaymentHistory,
} from "./actions";
import { KeuanganClient } from "./_components/KeuanganClient";

export const dynamic = "force-dynamic";

export default async function KeuanganPage() {
  const [data, expenses, purchases, payments, supplierPayments, capitalTransactions, capitalSummary] = await Promise.all([
    getKeuanganPageData(),
    getExpenseHistory(),
    getPurchaseHistory(),
    getPaymentHistory(),
    getSupplierPaymentHistory(),
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
    />
  );
}
