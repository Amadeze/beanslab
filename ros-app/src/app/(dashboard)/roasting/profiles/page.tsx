import { getReusableRoastProfiles, getTenantRoastLevels, getMachineOptions } from "../actions";
import { RoastProfileClient } from "./_components/RoastProfileClient";

export const dynamic = "force-dynamic";

export default async function RoastProfilesPage() {
  const [profiles, customLevels, machines] = await Promise.all([
    getReusableRoastProfiles(),
    getTenantRoastLevels(),
    getMachineOptions(),
  ]);

  return (
    <RoastProfileClient
      profiles={profiles}
      customLevels={customLevels}
      machines={machines}
    />
  );
}
