import { AlertTriangle, RefreshCw } from "lucide-react";

interface ReportErrorProps {
  message: string;
  onRetry?: () => void;
}

export function ReportError({ message, onRetry }: ReportErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50/60 px-6 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500" />
      <p className="max-w-md text-sm text-red-700">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          <RefreshCw size={14} />
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}
