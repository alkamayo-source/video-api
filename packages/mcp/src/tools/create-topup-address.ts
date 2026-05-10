import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@multiful/video-api-sdk";
import { ApiError } from "@multiful/video-api-sdk";

import { jsonContent } from "./index.js";

const inputSchema = {
  package: z
    .enum(["starter", "standard", "growth", "pro"])
    .describe(
      "Credit package: starter ($10/1000cr), standard ($25/2750cr +10%), growth ($50/6000cr +20%), pro ($100/13000cr +30%).",
    ),
  pay_currency: z
    .enum(["usdttrc20", "usdtbsc", "usdcbase", "usdcsol", "btc"])
    .optional()
    .describe(
      "Crypto currency to pay with. Default: usdttrc20 (lowest fees ~$0.3-1, fastest finality ~3sec).",
    ),
};

export function registerCreateTopupAddress(server: McpServer, client: Client): void {
  server.registerTool(
    "create_topup_address",
    {
      description:
        "Create a crypto deposit address for autonomous credit top-up. Returns pay_address and EXACT pay_amount — your wallet must send precisely that amount, otherwise credits will not be granted (partially_paid status).\n\n" +
        "Workflow:\n" +
        "1. Call this tool → get pay_address + pay_amount\n" +
        "2. Send exactly pay_amount of pay_currency to pay_address from your wallet\n" +
        "3. Poll get_topup_status or check_balance — credits land within ~1-3 minutes of on-chain confirmation",
      inputSchema,
    },
    async (args) => {
      try {
        const result = await client.billing.createTopupAddress({
          package: args.package,
          pay_currency: args.pay_currency,
        });
        return jsonContent({
          ok: true,
          payment_id: result.payment_id,
          pay_address: result.pay_address,
          pay_amount: result.pay_amount,
          pay_currency: result.pay_currency,
          amount_usd: result.amount_usd,
          credits: result.credits,
          bonus_percent: result.bonus_percent,
          expires_at: result.expires_at,
          instructions: `Send EXACTLY ${result.pay_amount} ${String(result.pay_currency).toUpperCase()} to ${result.pay_address}. Use get_topup_status with payment_id="${result.payment_id}" to track confirmation.`,
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
