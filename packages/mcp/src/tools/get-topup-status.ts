import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@multiful/video-api-sdk";
import { ApiError } from "@multiful/video-api-sdk";

import { jsonContent } from "./index.js";

const inputSchema = {
  payment_id: z.string().min(1).describe("payment_id from create_topup_address."),
};

export function registerGetTopupStatus(server: McpServer, client: Client): void {
  server.registerTool(
    "get_topup_status",
    {
      description:
        "Check the live status of a deposit. Lifecycle:\n" +
        "  waiting → confirming → confirmed → sending → finished  (success)\n" +
        "  waiting → expired                                       (no payment)\n" +
        "  any → failed | refunded | partially_paid               (error paths)\n\n" +
        "When status='finished', credits have been granted to your account (verify with check_balance).",
      inputSchema,
    },
    async (args) => {
      try {
        const result = await client.billing.topupStatus(args.payment_id);
        return jsonContent({
          ok: true,
          payment_id: result.payment_id,
          payment_status: result.payment_status,
          pay_address: result.pay_address,
          pay_amount: result.pay_amount,
          actually_paid: result.actually_paid,
          pay_currency: result.pay_currency,
          terminal: ["finished", "failed", "refunded", "expired"].includes(
            result.payment_status ?? "",
          ),
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
