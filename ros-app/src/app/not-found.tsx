import Link from "next/link";
import { Coffee, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full flex flex-col items-center space-y-6">
        <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mb-2">
          <Coffee size={32} />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Halaman Tidak Ditemukan
          </h1>
          <p className="text-slate-500">
            Maaf, halaman yang Anda cari tidak ada atau mungkin sudah dipindahkan.
          </p>
        </div>

        <Link 
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-amber-600 hover:bg-amber-700 transition-colors w-full"
        >
          <ArrowLeft className="mr-2" size={20} />
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
