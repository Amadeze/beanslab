import { getContracts } from "../contract-actions";
import { KontrakClient } from "./_components/KontrakClient";

export const dynamic = "force-dynamic";

export default async function KontrakPage() {
  const initialData = await getContracts();
  return <KontrakClient initialData={initialData} />;
}
