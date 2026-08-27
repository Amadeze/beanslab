import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AccessDenied() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 shadow-sm">
        <ShieldAlert size={28} />
      </div>
      <h2 className="font-heading text-lg font-bold text-foreground">Akses Ditolak</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Anda tidak memiliki izin untuk mengakses halaman ini. Peran Anda saat ini tidak diizinkan untuk melihat atau melakukan tindakan di sini.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link href="/dashboard" passHref legacyBehavior>
          <Button variant="default">Kembali ke Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
