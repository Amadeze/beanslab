import { PageHeader } from "@/components/layout/PageHeader";
import { ScanSearch } from "./_components/ScanSearch";
import { requireRole } from "@/lib/auth";

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const { code } = await searchParams;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Pindai Lokasi"
        description="Pindai kode QR atau masukkan kode lokasi untuk melihat stok di posisi tersebut."
      />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[800px] p-4 md:p-6 lg:p-8">
          <ScanSearch initialCode={code ?? undefined} />
        </div>
      </div>
    </div>
  );
}
