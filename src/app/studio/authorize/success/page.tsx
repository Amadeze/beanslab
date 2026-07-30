import { CheckCircle2, Monitor } from "lucide-react";

export default async function StudioAuthorizeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ machine?: string }>;
}) {
  const { machine = "mesin roasting" } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-[#0b0f10] p-5 text-[#f2e7d5]">
      <section className="w-full max-w-md rounded-[22px] border border-white/10 bg-[#111617] p-9 text-center shadow-2xl">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-[#5dd39e]/30 bg-[#5dd39e]/10"><CheckCircle2 className="text-[#5dd39e]" /></span>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[.16em] text-[#5dd39e]">Terhubung</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-.03em]">Roastd Studio siap</h1>
        <p className="mt-3 text-sm leading-6 text-[#809091]">Komputer ini terhubung ke <strong className="text-[#f2e7d5]">{machine}</strong>. Anda boleh menutup tab ini.</p>
        <div className="mt-7 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0b0f10] px-4 py-3 text-xs text-[#aab5b5]"><Monitor size={15} className="text-[#5ad4dc]" /> Kembali ke aplikasi Roastd Studio</div>
      </section>
    </main>
  );
}
