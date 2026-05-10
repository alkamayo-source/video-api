/**
 * MCP server factory.
 *
 * Wires up the SDK client + zod-validated tool handlers.
 * Tool definitions live in ./tools/*.ts; this module just registers them.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type Client } from "@multiful/video-api-sdk";
import { registerTools } from "./tools/index.js";

export interface ServerConfig {
  apiKey: string;
  baseUrl?: string;
}

export function buildServer(config: ServerConfig): { server: McpServer; client: Client } {
  const client = createClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });

  const server = new McpServer(
    {
      name: "video-api-mcp",
      version: "0.1.0",
    },
    {
      capabilities: { tools: {} },
    },
  );

  registerTools(server, client);

  return { server, client };
}
