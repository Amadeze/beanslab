"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, MailCheck, Send } from "lucide-react";
import { resendVerificationEmail, verifyEmail } from "./actions";

type VerifyState = "idle" | "verifying" | "verified" | "failed";

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const sentNotice = searchParams.get("sent") === "1";
  const prefillEmail = searchParams.get("email") ?? "";

  const [state, setState] = useState<VerifyState>("idle");
  const [error, setError] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [email, setEmail] = useState(prefillEmail);

  // Guard: effect can double-run in React strict mode — verify only once.
  const verifyStartedRef = useRef(false);

  useEffect(() => {
    if (!token || verifyStartedRef.current) return;
    verifyStartedRef.current = true;
    setState("verifying");
    verifyEmail(token)
      .then((result) => {
        if (result.success) {
          setState("verified");
        } else {
          setError(result.error);
          setState("failed");
        }
      })
      .catch(() => {
        setError("Verifikasi gagal. Coba lagi.");
        setState("failed");
      });
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendMessage("");
    setResendLoading(true);
    try {
      const result = await resendVerificationEmail(email);
      setResendMessage(result.message);
    } finally {
      setResendLoading(false);
    }
  };

  if (state === "verifying") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Memverifikasi email Anda…</p>
      </div>
    );
  }

  if (state === "verified") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 py-6 text-center"
      >
        <CheckCircle2 className="size-9 text-green-600" />
        <div>
          <p className="font-bold text-foreground">Email terverifikasi</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspace Anda aktif. Silakan masuk untuk mulai beroperasi.
          </p>
        </div>
        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center rounded-[10px] bg-primary font-bold text-primary-foreground shadow-[0_12px_28px_-18px_rgba(91,32,17,.7)] transition-colors hover:bg-primary/90"
        >
          Masuk sekarang
        </Link>
      </motion.div>
    );
  }

  const showIntro = sentNotice && state !== "failed";

  return (
    <form onSubmit={handleResend} className="flex flex-col gap-5">
      {showIntro ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 py-4 text-center"
        >
          <MailCheck className="size-9 text-primary" />
          <div>
            <p className="font-bold text-foreground">Periksa inbox Anda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Kami mengirim tautan verifikasi. Klik tautan di email untuk
              mengaktifkan workspace. Tautan berlaku 24 jam.
            </p>
          </div>
        </motion.div>
      ) : null}

      {state === "failed" ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 rounded-[10px] border border-destructive/20 bg-destructive/8 px-4 py-3"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-destructive">{error}</p>
        </motion.div>
      ) : null}

      {resendMessage ? (
        <div className="rounded-[10px] border border-green-600/20 bg-green-600/8 px-4 py-3 text-sm text-green-700">
          {resendMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email kerja
        </label>
        <input
          type="email"
          placeholder="admin@senjaroastery.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 w-full rounded-[10px] border border-input bg-card px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
      </div>

      <button
        type="submit"
        disabled={resendLoading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-input bg-background font-bold text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
      >
        {resendLoading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-4" />}
        Kirim ulang tautan verifikasi
      </button>

      <Link
        href="/login"
        className="text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Kembali ke halaman masuk
      </Link>
    </form>
  );
}
