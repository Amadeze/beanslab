"use client";

import { Toaster } from "@/components/ui/sonner";

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" richColors />
    </>
  );
}
