import { getRoastProfiles, getRoastingPageData } from "./actions";
import { RoastingClient } from "./_components/RoastingClient";

export const dynamic = "force-dynamic";

export default async function RoastingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const query = await searchParams;
  const activeTab = query.tab === "profiles" ? "profiles" : "batches";
  const [data, roastProfiles] = await Promise.all([
    getRoastingPageData(),
    activeTab === "profiles" ? getRoastProfiles() : Promise.resolve([]),
  ]);

  return (
    <RoastingClient
      activeTab={activeTab}
      batches={data.batches}
      gbOptions={data.gbOptions}
      rbOptions={data.rbOptions}
      machineOptions={data.machineOptions}
      roastProfiles={roastProfiles}
      reusableProfiles={data.reusableProfiles}
      customRoastLevels={data.customRoastLevels}
    />
  );
}
