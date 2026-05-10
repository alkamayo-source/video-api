/**
 * Polling helpers — exported as standalone functions, not methods on the client.
 *
 * Why standalone: when webhooks land (planned), polling becomes vestigial.
 * Keeping these as separate exports makes them easy to deprecate without
 * breaking the typed client surface.
 */

import type { Client, VideoStatusResponse, TopupStatusResponse } from "./client";
import { ApiError } from "./errors";

export interface WaitForVideoOptions {
  /** Polling interval in ms. Default 5000. */
  intervalMs?: number;
  /** Max total wait time in ms. Default 30 minutes. */
  timeoutMs?: number;
  /** Cancel the wait via AbortSignal. */
  signal?: AbortSignal;
  /** Called on every status check (including in-flight ones). */
  onProgress?: (status: VideoStatusResponse) => void;
}

/**
 * Poll `client.video.status(requestId)` until the job is `completed` or `failed`.
 *
 * Returns the terminal status response (which includes `video` base64 on success).
 *
 * Throws `ApiError` on timeout or AbortSignal cancellation.
 */
export async function waitForVideo(
  client: Client,
  requestId: string,
  opts: WaitForVideoOptions = {},
): Promise<VideoStatusResponse> {
  const intervalMs = opts.intervalMs ?? 5000;
  const timeoutMs = opts.timeoutMs ?? 30 * 60_000;
  const deadline = Date.now() + timeoutMs;

  // Loop with abort + timeout checks.
  while (true) {
    if (opts.signal?.aborted) {
      throw new ApiError("waitForVideo aborted", 0, "api_error");
    }
    if (Date.now() > deadline) {
      throw new ApiError(`waitForVideo timed out after ${timeoutMs}ms`, 0, "api_error");
    }

    const status = await client.video.status(requestId);
    opts.onProgress?.(status);
    if (status.status === "completed" || status.status === "failed") return status;

    // Wait, but break early on abort.
    await sleep(intervalMs, opts.signal);
  }
}

export interface WaitForTopupOptions {
  /** Polling interval in ms. Default 10_000 (TRON ~3sec block, but IPN delay can take ~1min). */
  intervalMs?: number;
  /** Max total wait time in ms. Default 1 hour (NOWPayments charge expiry). */
  timeoutMs?: number;
  /** Cancel via AbortSignal. */
  signal?: AbortSignal;
  /** Called on every status check. */
  onProgress?: (status: TopupStatusResponse) => void;
}

/**
 * Poll `client.billing.topupStatus(paymentId)` until terminal status.
 *
 * Terminal statuses: `finished`, `failed`, `refunded`, `expired`.
 * Note `partially_paid` is NOT treated as terminal — additional payment may still complete it.
 */
export async function waitForTopup(
  client: Client,
  paymentId: string,
  opts: WaitForTopupOptions = {},
): Promise<TopupStatusResponse> {
  const intervalMs = opts.intervalMs ?? 10_000;
  const timeoutMs = opts.timeoutMs ?? 60 * 60_000;
  const deadline = Date.now() + timeoutMs;
  const terminal = new Set(["finished", "failed", "refunded", "expired"]);

  while (true) {
    if (opts.signal?.aborted) {
      throw new ApiError("waitForTopup aborted", 0, "api_error");
    }
    if (Date.now() > deadline) {
      throw new ApiError(`waitForTopup timed out after ${timeoutMs}ms`, 0, "api_error");
    }

    const status = await client.billing.topupStatus(paymentId);
    opts.onProgress?.(status);
    if (status.payment_status && terminal.has(status.payment_status)) return status;

    await sleep(intervalMs, opts.signal);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError("aborted", 0, "api_error"));
    const t = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new ApiError("aborted", 0, "api_error"));
    };
    function cleanup() {
      clearTimeout(t);
      signal?.removeEventListener("abort", onAbort);
    }
    signal?.addEventListener("abort", onAbort);
  });
}
