import { PageHeader } from "@/components/layout/PageHeader";
import { ScanSearch } from "./_components/ScanSearch";
import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const { code } = await searchParams;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Stok per Lokasi"
        description="Pindai kode QR atau masukkan kode lokasi untuk melihat stok di posisi tersebut."
        actions={
          <Link
            href="/inventory"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white/60 px-3 text-xs font-semibold text-slate-700 transition hover:bg-white"
          >
            Pasokan & Stok →
          </Link>
        }
      />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[800px] p-4 md:p-6 lg:p-8">
          <ScanSearch initialCode={code ?? undefined} />
        </div>
      </div>
    </div>
  );
}
