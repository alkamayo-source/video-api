import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@multiful/video-api-sdk";
import type { VideoGenerateRequest } from "@multiful/video-api-sdk";
import { ApiError } from "@multiful/video-api-sdk";

import { normalizeImage } from "../image.js";
import { jsonContent } from "./index.js";

const inputSchema = {
  image: z
    .string()
    .min(1)
    .describe(
      "Source image. Accepts: file path (e.g. './photo.jpg'), http(s) URL, base64-encoded string, or data URI. Auto-normalized to base64.",
    ),
  template: z
    .string()
    .optional()
    .describe(
      "Video template name. Examples: tops_remove, all_take_off, bottoms_remove, missionary, cowgirl, doggy, handjob, blowjob. Default: all_take_off.",
    ),
  quality_preset: z
    .enum(["ultra_fast", "fast", "balanced", "quality"])
    .optional()
    .describe(
      "Quality preset. Default: balanced. Cost: ultra_fast=10cr / fast=14cr / balanced=20cr / quality=30cr.",
    ),
  prompt: z
    .string()
    .optional()
    .describe("Custom prompt override. If omitted, the template's default prompt is used."),
  negative_prompt: z.string().optional(),
  num_frames: z.number().int().optional().describe("Default 97."),
  fps: z.number().int().optional().describe("Default 16."),
  steps: z.number().int().optional(),
  cfg: z.number().optional(),
  seed: z.number().int().optional().describe("Random seed. -1 = random. Default -1."),
};

export function registerGenerateVideo(server: McpServer, client: Client): void {
  server.registerTool(
    "generate_video",
    {
      description:
        "Submit an AI video generation job. Returns a request_id immediately; use wait_for_video or get_video_status to retrieve the result.\n\n" +
        "Cost (credits, autonomous-agent tier): ultra_fast=25, fast=35, balanced=50, quality=75.\n" +
        "Top up via create_topup_address if you get an insufficient_credits error.",
      inputSchema,
    },
    async (args) => {
      try {
        const image = await normalizeImage(args.image);
        // Cast template to the SDK's enum union — server-side validates anyway,
        // and zod is intentionally permissive here so new templates work without a release.
        const req: VideoGenerateRequest = {
          image,
          template: args.template as VideoGenerateRequest["template"],
          quality_preset: args.quality_preset,
          prompt: args.prompt,
          negative_prompt: args.negative_prompt,
          num_frames: args.num_frames,
          fps: args.fps,
          steps: args.steps,
          cfg: args.cfg,
          seed: args.seed,
        };
        const result = await client.video.generate(req);
        return jsonContent({
          ok: true,
          request_id: result.request_id,
          status: result.status,
          credits_charged: result.credits_charged,
          estimated_time_seconds: result.estimated_time_seconds,
          next_step:
            "Call wait_for_video with this request_id, ideally with output_path set to write the result to disk.",
        });
      } catch (err) {
        return jsonContent(formatError(err));
      }
    },
  );
}

function formatError(err: unknown): { ok: false; error: string; code: string; status?: number } {
  if (err instanceof ApiError) {
    return { ok: false, error: err.message, code: err.code, status: err.status };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, error: msg, code: "client_error" };
}
