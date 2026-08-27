import { getProductionPageData } from "./actions";
import { ProductionClient } from "./_components/ProductionClient";

export const dynamic = "force-dynamic";

export default async function ProduksiPage() {
  const data = await getProductionPageData();
  return (
    <ProductionClient
      batches={data.batches}
      fgOptions={data.fgOptions}
      rbOptions={data.rbOptions}
      packagingOptions={data.packagingOptions}
      supplyOptions={data.supplyOptions}
      locationOptions={data.locationOptions}
    />
  );
}
