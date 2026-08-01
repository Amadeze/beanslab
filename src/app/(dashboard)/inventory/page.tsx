import { getInventoryPageData, getPackagingOptions, getReorderAlertData } from "./actions";
import { getPOSummary } from "./po-actions";
import { InventoryClient } from "./_components/InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [data, packagings, reorderData, poSummary] = await Promise.all([
    getInventoryPageData(),
    getPackagingOptions(),
    getReorderAlertData(),
    getPOSummary(),
  ]);

  return (
    <InventoryClient
      gbStocks={data.gbStocks}
      rbStocks={data.rbStocks}
      pkgStocks={data.pkgStocks}
      fgStocks={data.fgStocks}
      ledgerEntries={data.ledgerEntries}
      suppliers={data.suppliers}
      gbProducts={data.gbProducts}
      sampleConsumption={data.sampleConsumption}
      lotsByProduct={data.lotsByProduct}
      packagings={packagings.map((p) => ({
        id:          p.id,
        name:        p.name,
        code:        p.code,
        costPerUnit: Number(p.costPerUnit),
      }))}
      productReorderSummaries={reorderData.productSummaries}
      packagingReorderSummaries={reorderData.packagingSummaries}
      poSummary={poSummary}
    />
  );
}
