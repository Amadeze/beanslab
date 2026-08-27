"use client";

import { RouteErrorState } from "@/components/RouteErrorState";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <RouteErrorState error={error} unstable_retry={unstable_retry} />;
}
