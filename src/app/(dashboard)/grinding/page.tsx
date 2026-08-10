import { getGrindingPageData } from "./actions";
import { GrindingClient } from "./_components/GrindingClient";

export const dynamic = "force-dynamic";

export default async function GrindingPage() {
  const data = await getGrindingPageData();
  return (
    <GrindingClient
      batches={data.batches}
      rbOptions={data.rbOptions}
      groundCoffeeOptions={data.groundCoffeeOptions}
      grinderOptions={data.grinderOptions}
    />
  );
}
