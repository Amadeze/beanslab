export default function ControlTowerLoading() {
  return <div className="flex min-h-0 flex-1 animate-pulse flex-col bg-[#F6F6F1] p-6" aria-label="Memuat control tower"><div className="h-20 rounded-2xl bg-stone-200" /><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-stone-200" />)}</div><div className="mt-5 h-80 rounded-2xl bg-stone-200" /></div>;
}
