import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex-1 w-full h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-slate-50/50 p-6">
      <div className="flex flex-col items-center gap-4 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
        <p className="text-sm font-medium animate-pulse">Memuat data roastery...</p>
      </div>

      {/* Skeleton Mockup */}
      <div className="w-full max-w-4xl mt-12 opacity-40">
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-48 bg-slate-200 rounded-md animate-pulse"></div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl animate-pulse"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white border border-slate-100 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-8 w-1/2 bg-slate-300 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        <div className="h-64 w-full bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
          <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 w-full bg-slate-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
