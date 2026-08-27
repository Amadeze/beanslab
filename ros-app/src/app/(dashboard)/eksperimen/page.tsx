import { getExperimentalPageData } from "./actions";
import { ExperimentalClient } from "./_components/ExperimentalClient";

export const dynamic = "force-dynamic";

export default async function EksperimenPage() {
  const data = await getExperimentalPageData();
  return (
    <ExperimentalClient
      batches={data.batches}
      rbOptions={data.rbOptions}
      supplyOptions={data.supplyOptions}
      fgOptions={data.fgOptions}
      locationOptions={data.locationOptions}
    />
  );
}
