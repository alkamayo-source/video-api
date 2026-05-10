/**
 * @multiful/video-api-mcp
 *
 * stdio-mode MCP server for the Multiful Video API. Designed for Cursor,
 * Claude Desktop, and any MCP client that launches a subprocess.
 *
 * Configure via env vars:
 *   VIDEO_API_KEY  (required) — your nvapi_live_xxx key
 *   VIDEO_API_BASE_URL (optional) — override the API base URL (for self-hosted)
 *
 * Usage in MCP client config:
 *   {
 *     "mcpServers": {
 *       "video-api": {
 *         "command": "npx",
 *         "args": ["-y", "@multiful/video-api-mcp"],
 *         "env": { "VIDEO_API_KEY": "nvapi_live_xxx" }
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const apiKey = process.env.VIDEO_API_KEY;
  if (!apiKey) {
    console.error(
      "[video-api-mcp] FATAL: VIDEO_API_KEY env var is required.\n" +
        "Get your key by sending '/apikey your@email.com' to @MultifulDobi_bot on Telegram.",
    );
    process.exit(1);
  }

  const baseUrl = process.env.VIDEO_API_BASE_URL;

  const { server } = buildServer({ apiKey, baseUrl });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stdio transport keeps the process alive via stdin reads.
  // Surface unhandled rejections to the MCP client's stderr instead of crashing silently.
  process.on("unhandledRejection", (reason) => {
    console.error("[video-api-mcp] unhandled rejection:", reason);
  });
}

main().catch((err) => {
  console.error("[video-api-mcp] startup error:", err);
  process.exit(1);
});
