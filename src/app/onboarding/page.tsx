"use client";

import { motion } from "framer-motion";
import { Store, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "./actions";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleStart = async () => {
    setLoading(true);
    try {
      await completeOnboarding();
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-[20px] border border-border bg-card shadow-2xl"
      >
        <div className="p-8 text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Store className="size-8" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
            Selamat Datang di Roastery OS
          </h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Workspace roastery Anda telah berhasil dibuat. Saatnya menghubungkan mesin roasting, mencatat inventory, dan mengelola pesanan B2B Anda.
          </p>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStart}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-primary font-bold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                Masuk ke Dashboard
                <ArrowRight className="size-4" />
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
