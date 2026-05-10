/**
 * API error type. Thrown by the client on any non-2xx response.
 *
 * `code` is the API's error code string (e.g. "insufficient_credits").
 * `status` is the HTTP status code.
 *
 * For known codes, use the `ErrorCode` union for exhaustive switches.
 */

export type ErrorCode =
  | "unauthorized"
  | "invalid_api_key"
  | "account_suspended"
  | "insufficient_credits"
  | "rate_limit_exceeded"
  | "daily_limit_exceeded"
  | "invalid_request"
  | "invalid_template"
  | "invalid_quality_preset"
  | "invalid_pay_currency"
  | "invalid_package"
  | "invalid_parameter"
  | "not_found"
  | "forbidden"
  | "payment_provider_error"
  | "upstream_error"
  | "endpoint_deprecated"
  | "internal_error"
  | "api_error";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode | string;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    message: string,
    status: number,
    code: ErrorCode | string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
