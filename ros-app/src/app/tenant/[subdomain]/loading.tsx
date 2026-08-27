export default function StorefrontLoading() {
  return (
    <main className="min-h-screen bg-white px-5 py-6 text-slate-900" aria-busy="true" aria-label="Memuat storefront">
      <header className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-md bg-slate-200" />
        <div className="h-10 w-24 animate-pulse rounded-md bg-slate-200" />
      </header>
      <div className="mx-auto grid min-h-[75vh] max-w-7xl items-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_42%]">
        <div className="space-y-6">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          <div className="space-y-3">
            <div className="h-12 w-full max-w-2xl animate-pulse rounded bg-slate-200" />
            <div className="h-12 w-4/5 max-w-xl animate-pulse rounded bg-slate-200" />
          </div>
          <div className="h-4 w-full max-w-lg animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-3/4 max-w-md animate-pulse rounded bg-slate-100" />
          <div className="h-11 w-36 animate-pulse rounded-md bg-slate-200" />
        </div>
        <div className="aspect-[4/5] w-full animate-pulse rounded-lg bg-slate-200" />
      </div>
    </main>
  );
}
