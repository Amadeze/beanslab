import { getSalesPageData } from "./actions";
import { getSamplePageData } from "./sample-actions";
import { SalesClient } from "./_components/SalesClient";

export const dynamic = "force-dynamic";

export default async function PenjualanPage() {
  const [data, sampleData] = await Promise.all([getSalesPageData(), getSamplePageData()]);
  return (
    <SalesClient
      invoices={data.invoices}
      customers={data.customers}
      fgOptions={data.fgOptions}
      contractPrices={data.contractPrices}
      sampleData={sampleData}
    />
  );
}
