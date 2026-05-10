import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@multiful/video-api-sdk";

import { registerGenerateVideo } from "./generate-video.js";
import { registerGetVideoStatus } from "./get-video-status.js";
import { registerWaitForVideo } from "./wait-for-video.js";
import { registerCheckBalance } from "./check-balance.js";
import { registerListPackages } from "./list-packages.js";
import { registerCreateTopupAddress } from "./create-topup-address.js";
import { registerGetTopupStatus } from "./get-topup-status.js";

export function registerTools(server: McpServer, client: Client): void {
  registerGenerateVideo(server, client);
  registerGetVideoStatus(server, client);
  registerWaitForVideo(server, client);
  registerCheckBalance(server, client);
  registerListPackages(server, client);
  registerCreateTopupAddress(server, client);
  registerGetTopupStatus(server, client);
}

/**
 * Helper: format any JSON-serializable value as MCP text content.
 */
export function jsonContent(value: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}
