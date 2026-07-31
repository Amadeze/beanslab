"use client";

import { RouteErrorState } from "@/components/RouteErrorState";

export default function KatalogError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void; }) {
  return <RouteErrorState error={error} unstable_retry={unstable_retry} homeHref="/dashboard" homeLabel="Kembali ke Dashboard" />;
}