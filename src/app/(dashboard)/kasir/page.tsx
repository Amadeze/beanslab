import { getCashierPageData } from "../penjualan/actions";
import { CashierClient } from "./_components/CashierClient";

export const dynamic = "force-dynamic";

export default async function CashierPage() {
  const data = await getCashierPageData();
  return <CashierClient customers={data.customers} products={data.fgOptions} />;
}
