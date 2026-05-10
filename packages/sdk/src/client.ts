/**
 * Multiful Video API client.
 *
 * Zero runtime dependencies — uses native `fetch` (Node 18+, browsers, Deno, Bun, Workers).
 */

import type { components } from "./generated/schema";
import { ApiError } from "./errors";

export type VideoGenerateRequest = components["schemas"]["VideoGenerateRequest"];
export type VideoGenerateResponse = components["schemas"]["VideoGenerateResponse"];
export type VideoStatusResponse = components["schemas"]["VideoStatusResponse"];
export type BalanceResponse = components["schemas"]["BalanceResponse"];
export type PackageListResponse = components["schemas"]["PackageListResponse"];
export type TopupAddressResponse = components["schemas"]["TopupAddressResponse"];
export type TopupStatusResponse = components["schemas"]["TopupStatusResponse"];
export type CurrenciesResponse = components["schemas"]["CurrenciesResponse"];
export type DepositsResponse = components["schemas"]["DepositsResponse"];
export type TransactionHistoryResponse = components["schemas"]["TransactionHistoryResponse"];

export type PayCurrency = "usdttrc20" | "usdtbsc" | "usdcbase" | "usdcsol" | "btc";
export type PackageKey = "starter" | "standard" | "growth" | "pro";
export type QualityPreset = "ultra_fast" | "fast" | "balanced" | "quality";

export interface ClientOptions {
  /** API key in format `nvapi_live_xxx`. Issue via `/apikey` Telegram command. */
  apiKey: string;
  /** Base URL for the API. Defaults to production. */
  baseUrl?: string;
  /** Custom fetch implementation (for testing or proxies). */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds. Default 60_000. */
  timeoutMs?: number;
  /** Additional headers sent on every request. */
  headers?: Record<string, string>;
}

export interface Client {
  video: {
    generate(req: VideoGenerateRequest): Promise<VideoGenerateResponse>;
    status(requestId: string): Promise<VideoStatusResponse>;
  };
  billing: {
    balance(): Promise<BalanceResponse>;
    packages(): Promise<PackageListResponse>;
    currencies(): Promise<CurrenciesResponse>;
    createTopupAddress(req: {
      package: PackageKey;
      pay_currency?: PayCurrency;
    }): Promise<TopupAddressResponse>;
    topupStatus(paymentId: string): Promise<TopupStatusResponse>;
    deposits(opts?: { limit?: number; offset?: number }): Promise<DepositsResponse>;
    history(opts?: { limit?: number; offset?: number }): Promise<TransactionHistoryResponse>;
  };
  health(): Promise<{ status: string; service?: string; version?: string; timestamp?: string }>;
  /** Escape hatch for endpoints not yet covered by typed methods. */
  raw<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;
}

const DEFAULT_BASE_URL = "https://telegram-ai-bot-4esd.onrender.com/v1";
const DEFAULT_TIMEOUT_MS = 60_000;

const API_KEY_FORMAT = /^nvapi_live_[a-f0-9]{64}$/i;

function isBrowser(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { window?: unknown }).window !== "undefined"
  );
}

export function createClient(opts: ClientOptions): Client {
  if (!opts.apiKey) {
    throw new Error("ClientOptions.apiKey is required");
  }
  if (!API_KEY_FORMAT.test(opts.apiKey)) {
    // Warn but don't throw — allows test/sandbox keys with custom format.
    if (typeof console !== "undefined") {
      console.warn(
        `[video-api-sdk] apiKey does not match expected format nvapi_live_<64-hex>. Continuing anyway.`,
      );
    }
  }
  if (isBrowser() && opts.apiKey.startsWith("nvapi_live_")) {
    if (typeof console !== "undefined") {
      console.warn(
        "[video-api-sdk] You appear to be running in a browser with a production API key. " +
          "API keys must NOT be embedded in client-side bundles — proxy through your server.",
      );
    }
  }

  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const extraHeaders = opts.headers ?? {};

  if (!fetchImpl) {
    throw new Error(
      "No fetch implementation available. Use Node 18+ or pass `fetch` in ClientOptions.",
    );
  }

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.apiKey}`,
        Accept: "application/json",
        ...extraHeaders,
      };
      if (body !== undefined) headers["Content-Type"] = "application/json";

      const res = await fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      // 204 No Content → return undefined as T
      if (res.status === 204) return undefined as unknown as T;

      const text = await res.text();
      let parsed: unknown = undefined;
      if (text.length > 0) {
        try {
          parsed = JSON.parse(text);
        } catch {
          if (!res.ok) {
            throw new ApiError(text || res.statusText, res.status, "api_error");
          }
          // 2xx with non-JSON body — return raw text wrapped
          return text as unknown as T;
        }
      }

      if (!res.ok) {
        const err = (parsed ?? {}) as {
          error?: string;
          message?: string;
          details?: Record<string, unknown>;
        };
        throw new ApiError(
          err.message ?? res.statusText,
          res.status,
          err.error ?? "api_error",
          err.details,
        );
      }

      return parsed as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e instanceof Error && e.name === "AbortError") {
        throw new ApiError(`Request timed out after ${timeoutMs}ms`, 0, "api_error");
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new ApiError(`Network error: ${msg}`, 0, "api_error");
    } finally {
      clearTimeout(timer);
    }
  }

  function qs(o: Record<string, string | number | undefined>): string {
    const parts = Object.entries(o)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    return parts.length ? `?${parts.join("&")}` : "";
  }

  return {
    video: {
      generate: (req) => call("POST", "/video/generate", req),
      status: (id) => call("GET", `/video/${encodeURIComponent(id)}`),
    },
    billing: {
      balance: () => call("GET", "/billing/balance"),
      packages: () => call("GET", "/billing/packages"),
      currencies: () => call("GET", "/billing/currencies"),
      createTopupAddress: (req) => call("POST", "/billing/topup-address", req),
      topupStatus: (id) => call("GET", `/billing/topup-status/${encodeURIComponent(id)}`),
      deposits: (o = {}) =>
        call("GET", `/billing/deposits${qs({ limit: o.limit, offset: o.offset })}`),
      history: (o = {}) =>
        call("GET", `/billing/history${qs({ limit: o.limit, offset: o.offset })}`),
    },
    health: () => call("GET", "/health"),
    raw: <T = unknown>(method: string, path: string, body?: unknown) => call<T>(method, path, body),
  };
}
