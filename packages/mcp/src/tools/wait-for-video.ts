import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@multiful/video-api-sdk";
import { ApiError, waitForVideo } from "@multiful/video-api-sdk";

import { jsonContent } from "./index.js";

const inputSchema = {
  request_id: z.string().min(1).describe("request_id returned by generate_video."),
  output_path: z
    .string()
    .optional()
    .describe(
      "Filesystem path to write the resulting MP4 to. STRONGLY RECOMMENDED — without this, the base64-encoded video is returned in the tool response, which can blow the LLM context window for non-trivial videos (5sec 480p ≈ 2-4MB base64).",
    ),
  interval_ms: z.number().int().optional().describe("Polling interval in ms. Default 5000."),
  timeout_ms: z
    .number()
    .int()
    .optional()
    .describe("Max wait time in ms. Default 1_800_000 (30min)."),
};

export function registerWaitForVideo(server: McpServer, client: Client): void {
  server.registerTool(
    "wait_for_video",
    {
      description:
        "Poll a video generation job until it completes (or fails). " +
        "If output_path is provided, decodes the base64 video and writes it to disk, returning ONLY the path and metadata (recommended for agent contexts).",
      inputSchema,
    },
    async (args) => {
      try {
        const result = await waitForVideo(client, args.request_id, {
          intervalMs: args.interval_ms,
          timeoutMs: args.timeout_ms,
        });

        if (result.status === "failed") {
          return jsonContent({
            ok: false,
            status: "failed",
            request_id: args.request_id,
            error: result.error ?? "video generation failed",
            metadata: result.metadata,
          });
        }

        // Success path
        if (args.output_path && result.video) {
          const absPath = resolve(args.output_path);
          await writeFile(absPath, Buffer.from(result.video, "base64"));
          return jsonContent({
            ok: true,
            status: "completed",
            request_id: args.request_id,
            output_path: absPath,
            metadata: result.metadata,
            processing_time_ms: result.processing_time_ms,
          });
        }

        // No output_path — return the base64 (caller's choice; warn in logs)
        return jsonContent({
          ok: true,
          status: "completed",
          request_id: args.request_id,
          warning:
            "output_path was not provided. Base64 video returned inline (~MB-scale). Pass output_path next time to write directly to disk.",
          video_base64_length: result.video?.length ?? 0,
          video: result.video,
          metadata: result.metadata,
          processing_time_ms: result.processing_time_ms,
        });
      } catch (err) {
        if (err instanceof ApiError) {
          return jsonContent({ ok: false, error: err.message, code: err.code, status: err.status });
        }
        const msg = err instanceof Error ? err.message : String(err);
        return jsonContent({ ok: false, error: msg, code: "client_error" });
      }
    },
  );
}
