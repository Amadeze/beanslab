/**
 * Safe toast wrappers.
 *
 * Sonner renders toast message/description text as HTML by default. External
 * strings (API error responses, exception messages, Midtrans/Resend payloads)
 * can therefore inject live <script>/<style> markup — which both trips React's
 * "Encountered a script tag while rendering React component" warning and is an
 * XSS vector. These wrappers coerce every argument to a plain string and strip
 * any markup/control characters before handing it to sonner.
 */
import { toast, type ToastT } from "sonner";

const TAG_AND_CONTROL = /<[^>]*>|[\u0000-\u001F\u007F]/g;

function sanitize(value: unknown): string {
  if (typeof value === "string") return value.replace(TAG_AND_CONTROL, "").trim();
  if (value == null) return "";
  if (value instanceof Error) {
    return (value.message || String(value)).replace(TAG_AND_CONTROL, "").trim();
  }
  if (typeof value === "object") {
    const candidate =
      (value as { message?: unknown }).message ??
      (value as { error?: unknown }).error ??
      (value as { error_description?: unknown }).error_description;
    if (typeof candidate === "string") {
      return candidate.replace(TAG_AND_CONTROL, "").trim();
    }
  }
  return String(value).replace(TAG_AND_CONTROL, "").trim();
}

type SafeToastArgs = [message: unknown, data?: Partial<ToastT>];

function emit(
  fn: (msg: string, data?: Partial<ToastT>) => string | number,
  ...args: SafeToastArgs
) {
  const [message, data] = args;
  return fn(sanitize(message), data);
}

export const toastSafe = {
  success: (...args: SafeToastArgs) => emit(toast.success, ...args),
  error: (...args: SafeToastArgs) => emit(toast.error, ...args),
  warning: (...args: SafeToastArgs) => emit(toast.warning, ...args),
  info: (...args: SafeToastArgs) => emit(toast.info, ...args),
  loading: (...args: SafeToastArgs) => emit(toast.loading, ...args),
  message: (...args: SafeToastArgs) => emit(toast.message, ...args),
  promise: toast.promise,
  dismiss: toast.dismiss,
};

export { sanitize };
