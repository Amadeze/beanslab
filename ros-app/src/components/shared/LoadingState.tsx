interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Memuat data..." }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
