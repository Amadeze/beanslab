"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { AuthFrame } from "@/components/auth/AuthFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await requestPasswordReset(email);
      setMessage(result.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="Pemulihan akses"
      title="Kembali ke ruang kendali."
      description="Masukkan email akun. Kami akan mengirim tautan reset yang berlaku selama 30 menit."
      asideTitle="Akses berhenti. Operasi tidak harus."
      asideDescription="Pemulihan akun tetap singkat, aman, dan tidak mengganggu jejak kerja roastery Anda."
      footer={(
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Kembali ke login
        </Link>
      )}
    >
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email akun</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="owner@roastery.id"
              className="h-12 bg-white"
            />
          </div>
          {message && (
            <p role="status" className="border border-domain-inventory/25 bg-domain-inventory/8 px-4 py-3 text-sm text-domain-inventory">
              {message}
            </p>
          )}
          <Button type="submit" disabled={loading} className="h-12 w-full">
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Kirim tautan reset"}
          </Button>
        </form>
    </AuthFrame>
  );
}
