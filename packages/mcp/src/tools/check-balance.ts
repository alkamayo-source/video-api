import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@multiful/video-api-sdk";
import { ApiError } from "@multiful/video-api-sdk";

import { jsonContent } from "./index.js";

export function registerCheckBalance(server: McpServer, client: Client): void {
  server.registerTool(
    "check_balance",
    {
      description:
        "Check the API key's current credit balance, total credits used, and tier. " +
        "Use before generate_video to ensure sufficient credits, or after a 402 insufficient_credits error.",
      inputSchema: {},
    },
    async () => {
      try {
        const balance = await client.billing.balance();
        return jsonContent({
          ok: true,
          credits_balance: balance.credits_balance,
          credits_used: balance.credits_used,
          tier: balance.tier,
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
