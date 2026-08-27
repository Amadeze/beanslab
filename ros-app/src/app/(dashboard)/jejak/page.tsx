import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth";
import { getJejakBoard } from "./actions";
import { JejakBoard as JejakBoardView } from "./_components/JejakBoard";

export const metadata: Metadata = { title: "Peta Jejak" };
export const dynamic = "force-dynamic";

export default async function JejakPage() {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const board = await getJejakBoard();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-[1700px] space-y-4 p-4 md:p-6">
        <PageHeader
          title="Peta Jejak"
          eyebrow="Traceability"
          description="Ikuti setiap lot dari penerimaan sampai jadi kemasan — klik kartu untuk menyorot rantainya."
        />
        <JejakBoardView board={board} />
      </div>
    </div>
  );
}
