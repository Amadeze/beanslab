import { getInventoryPageData, getPackagingOptions, getReorderAlertData, getSupplyOptions } from "./actions";
import { getPOSummary } from "./po-actions";
import { InventoryClient } from "./_components/InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [data, packagings, supplyOptions, reorderData, poSummary] = await Promise.all([
    getInventoryPageData(),
    getPackagingOptions(),
    getSupplyOptions(),
    getReorderAlertData(),
    getPOSummary(),
  ]);

  return (
    <InventoryClient
      gbStocks={data.gbStocks}
      rbStocks={data.rbStocks}
      supplyStocks={data.supplyStocks}
      fgStocks={data.fgStocks}
      ledgerEntries={data.ledgerEntries}
      suppliers={data.suppliers}
      gbProducts={data.gbProducts}
      sampleConsumption={data.sampleConsumption}
      lotsByProduct={data.lotsByProduct}
      supplyLotsByItem={data.supplyLotsByItem}
      packagings={packagings.map((p) => ({
        id:          p.id,
        name:        p.name,
        code:        p.code,
        costPerUnit: Number(p.costPerUnit),
      }))}
      supplyOptions={supplyOptions.map((s) => ({
        id:     s.id,
        name:   s.name,
        code:   s.code,
        category: s.category,
        baseUnit: s.baseUnit,
        costPerUnit: s.costPerUnit,
      }))}
      productReorderSummaries={reorderData.productSummaries}
      supplyReorderSummaries={reorderData.supplySummaries}
      poSummary={poSummary}
    />
  );
}
