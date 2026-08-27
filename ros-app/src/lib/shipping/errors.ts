// Controlled, typed domain errors for the shipping provider boundary.
// These NEVER contain the API key, raw provider body, or secret material.

export type ShippingProviderErrorCode =
  | "MISSING_CREDENTIAL"
  | "INTEGRATION_DISABLED"
  | "PROVIDER_UNAUTHORIZED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_BAD_REQUEST"
  | "PROVIDER_SERVER_ERROR"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_INVALID_RESPONSE"
  | "PROVIDER_EMPTY_RESULT"
  | "PROVIDER_UNEXPECTED";

export class ShippingProviderError extends Error {
  readonly code: ShippingProviderErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    code: ShippingProviderErrorCode,
    message: string,
    options?: { status?: number; retryable?: boolean },
  ) {
    super(message);
    this.name = "ShippingProviderError";
    this.code = code;
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
  }

  /** Safe, controlled error code surfaced to clients (never the raw message). */
  toClientError() {
    return { code: this.code, retryable: this.retryable };
  }
}
