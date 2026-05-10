import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@multiful/video-api-sdk";
import { ApiError } from "@multiful/video-api-sdk";

import { jsonContent } from "./index.js";

const inputSchema = {
  request_id: z.string().min(1),
  output_path: z
    .string()
    .optional()
    .describe(
      "If provided AND the job is completed, write the MP4 to this path and omit base64 from the response.",
    ),
};

export function registerGetVideoStatus(server: McpServer, client: Client): void {
  server.registerTool(
    "get_video_status",
    {
      description:
        "Single-shot status check for a video job. Use wait_for_video for polling. " +
        "Returns: status (pending|processing|completed|failed), metadata, and video base64 if completed.",
      inputSchema,
    },
    async (args) => {
      try {
        const result = await client.video.status(args.request_id);

        if (result.status === "completed" && args.output_path && result.video) {
          const absPath = resolve(args.output_path);
          await writeFile(absPath, Buffer.from(result.video, "base64"));
          return jsonContent({
            ok: true,
            status: result.status,
            request_id: args.request_id,
            output_path: absPath,
            metadata: result.metadata,
            processing_time_ms: result.processing_time_ms,
          });
        }

        return jsonContent({
          ok: result.status !== "failed",
          status: result.status,
          request_id: args.request_id,
          ...(result.video
            ? { video: result.video, video_base64_length: result.video.length }
            : {}),
          metadata: result.metadata,
          error: result.error,
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
