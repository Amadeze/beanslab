import { Suspense } from "react";
import Link from "next/link";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { VerifyEmailClient } from "./VerifyEmailClient";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <AuthFrame
      eyebrow="Verifikasi email"
      title="Satu langkah lagi."
      description="Konfirmasi kepemilikan email untuk mengaktifkan akses ke workspace Anda."
      asideTitle="Akses workspace dimulai dari email yang terverifikasi."
      asideDescription="Tautan verifikasi berlaku 24 jam dan hanya dapat digunakan satu kali. Jika kedaluwarsa, Anda dapat meminta tautan baru."
      footer={
        <p>
          Sudah verifikasi?{" "}
          <Link href="/login" className="font-semibold text-primary hover:text-primary/75">
            Masuk ke workspace
          </Link>
        </p>
      }
    >
      <Suspense fallback={<div className="py-10 text-sm text-muted-foreground">Menyiapkan verifikasi…</div>}>
        <VerifyEmailClient />
      </Suspense>
    </AuthFrame>
  );
}
