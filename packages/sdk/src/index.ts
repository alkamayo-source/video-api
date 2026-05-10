/**
 * @multiful/video-api-sdk
 *
 * TypeScript SDK for the Multiful Video API. Designed for autonomous agents
 * (Cursor / Claude Desktop / OpenAI Agents) and human developers.
 *
 * Quick start:
 *
 *   import { createClient, waitForVideo } from "@multiful/video-api-sdk";
 *   const api = createClient({ apiKey: process.env.VIDEO_API_KEY! });
 *   const job = await api.video.generate({ image, template: "tops_remove" });
 *   const result = await waitForVideo(api, job.request_id);
 *
 * See the full Quickstart: https://github.com/alkamayo-source/video-api/blob/main/README.md
 */

export { createClient } from "./client";
export type {
  Client,
  ClientOptions,
  PackageKey,
  PayCurrency,
  QualityPreset,
  VideoGenerateRequest,
  VideoGenerateResponse,
  VideoStatusResponse,
  BalanceResponse,
  PackageListResponse,
  TopupAddressResponse,
  TopupStatusResponse,
  CurrenciesResponse,
  DepositsResponse,
  TransactionHistoryResponse,
} from "./client";

export { ApiError } from "./errors";
export type { ErrorCode } from "./errors";

export { waitForVideo, waitForTopup } from "./poll";
export type { WaitForVideoOptions, WaitForTopupOptions } from "./poll";

// Re-export the raw OpenAPI components/paths for advanced consumers.
export type { components, paths } from "./generated/schema";
