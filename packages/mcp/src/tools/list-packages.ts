import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@multiful/video-api-sdk";
import { ApiError } from "@multiful/video-api-sdk";

import { jsonContent } from "./index.js";

export function registerListPackages(server: McpServer, client: Client): void {
  server.registerTool(
    "list_packages",
    {
      description:
        "List the available top-up packages (USD prices, credit amounts, bonus percentages). " +
        "No authentication required. Use this to choose a package key for create_topup_address.",
      inputSchema: {},
    },
    async () => {
      try {
        const result = await client.billing.packages();
        return jsonContent({ ok: true, packages: result.packages });
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
