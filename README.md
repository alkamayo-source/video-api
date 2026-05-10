# Quickstart — Multiful Video API

Generate AI videos via API. Designed for **autonomous agents** (Cursor, Claude Desktop, OpenAI Agents) and **vibe coders**. Pay with crypto (USDT-TRC20), no human checkout flow.

**Time to first video**: ~5 minutes.

---

## 1. Get an API key (30 sec)

Open Telegram and message **[@MultifulDobi_bot](https://t.me/MultifulDobi_bot)**:

```
/apikey your@email.com
```

The bot replies with your key (`nvapi_live_xxx...`). **Save it.** Free tier includes 10 credits — enough for one fast test video.

> One key per Telegram account. Lose it? Send `/apikey` again to view.

---

## 2. Verify with cURL (1 line)

```bash
curl -H "Authorization: Bearer nvapi_live_xxx" \
  https://telegram-ai-bot-4esd.onrender.com/v1/billing/balance
```

Expected: `{"credits_balance": 10, "credits_used": 0, "tier": "free"}`.

---

## 3. TypeScript SDK (5 lines)

```bash
npm install @multiful/video-api-sdk
```

```ts
import { createClient, waitForVideo } from "@multiful/video-api-sdk";
import fs from "node:fs";

const api = createClient({ apiKey: process.env.VIDEO_API_KEY! });
const image = fs.readFileSync("./photo.jpg").toString("base64");

const job = await api.video.generate({
  image,
  template: "tops_remove",
  quality_preset: "fast",
});
const result = await waitForVideo(api, job.request_id, {
  onProgress: (s) => console.log(s.status),
});
fs.writeFileSync("out.mp4", Buffer.from(result.video!, "base64"));
```

That's it. `waitForVideo` polls until the job finishes (or fails). The result's `video` field is base64 MP4.

> Memory note: a 5-second 480p clip is roughly 2-4 MB base64 in memory. If you don't want to hold it in RAM, decode and stream to disk as shown above.

---

## 4. MCP Server (1-line setup for Cursor / Claude Desktop)

Add to `~/.cursor/mcp.json` (Cursor) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Claude Desktop):

```json
{
  "mcpServers": {
    "video-api": {
      "command": "npx",
      "args": ["-y", "@multiful/video-api-mcp"],
      "env": { "VIDEO_API_KEY": "nvapi_live_xxx" }
    }
  }
}
```

Restart your client. Then in chat:

> "Use video-api to generate a video from photo.jpg with template tops_remove, save to out.mp4"

The agent calls `generate_video` → `wait_for_video` (writes MP4 to disk via `output_path`, **does not** stuff base64 into context).

### MCP tools available

| Tool                   | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `generate_video`       | Submit job. `image` accepts base64, file path, or URL — auto-normalized. |
| `wait_for_video`       | Poll until done; writes MP4 to `output_path`.                            |
| `get_video_status`     | Single status check (no polling).                                        |
| `check_balance`        | Current credits / tier.                                                  |
| `list_packages`        | Top-up packages.                                                         |
| `create_topup_address` | Get USDT-TRC20 deposit address.                                          |
| `get_topup_status`     | Poll a deposit's confirmation status.                                    |

---

## 5. Autonomous top-up (no human in the loop)

When `credits_balance` runs low, an agent with crypto wallet access can self-fund:

```ts
const dep = await api.billing.createTopupAddress({
  package: "growth", // 6,000 credits ($50 USD)
  pay_currency: "usdttrc20", // default
});

console.log(`Send ${dep.pay_amount} USDT-TRC20 to ${dep.pay_address}`);
// Agent's wallet broadcasts the transfer. On-chain confirmation
// (~3 sec on TRON) triggers our IPN webhook → credits land within ~1 min.

// Poll until landed:
let attempt = 0;
while (attempt++ < 30) {
  const bal = await api.billing.balance();
  if (bal.credits_balance >= dep.credits) break;
  await new Promise((r) => setTimeout(r, 10_000));
}
```

### Available packages

| Key        | Price | Credits | Bonus |
| ---------- | ----- | ------- | ----- |
| `starter`  | $10   | 1,000   | –     |
| `standard` | $25   | 2,750   | +10%  |
| `growth`   | $50   | 6,000   | +20%  |
| `pro`      | $100  | 13,000  | +30%  |

### Supported pay currencies

`usdttrc20` (default, recommended), `usdtbsc`, `usdcbase`, `usdcsol`, `btc`.

> **Send the exact `pay_amount`.** Underpayment results in `partially_paid` status — credits are NOT granted. Use the SDK to read `pay_amount` programmatically rather than rounding.

---

## 6. Reference

- **Templates** (21): `all_take_off`, `tops_remove`, `bottoms_remove`, `handjob`, `cunnilingus`, `missionary`, `cowgirl`, `doggy`, ... See full list in `GET /v1/video/templates` or [openapi.yaml](./openapi.yaml).
- **Quality presets**: `ultra_fast` (10cr · ~1min) / `fast` (14cr · ~2min) / `balanced` (20cr · ~3min) / `quality` (30cr · ~5min).
- **Full API spec**: [docs/openapi.yaml](./openapi.yaml) — OpenAPI 3.1.
- **Detailed guide**: [docs/API_GATEWAY.md](./API_GATEWAY.md).

---

## 7. Error handling

The SDK throws `ApiError`:

```ts
import { ApiError } from "@multiful/video-api-sdk";

try {
  await api.video.generate({ ... });
} catch (e) {
  if (e instanceof ApiError) {
    console.error(`[${e.status} ${e.code}] ${e.message}`);
    if (e.code === "insufficient_credits") {
      // trigger autonomous top-up (section 5)
    }
  }
}
```

Common error codes:

| Code                     | Status | What to do                                              |
| ------------------------ | ------ | ------------------------------------------------------- |
| `unauthorized`           | 401    | Check `Authorization: Bearer ` prefix                   |
| `invalid_api_key`        | 401    | Re-fetch via `/apikey` Telegram command                 |
| `insufficient_credits`   | 402    | Top-up (section 5)                                      |
| `rate_limit_exceeded`    | 429    | Respect `Retry-After` header; back off                  |
| `invalid_template`       | 400    | See valid template list                                 |
| `payment_provider_error` | 502    | NOWPayments unreachable; retry with exponential backoff |

---

## 8. Troubleshooting

- **401 unauthorized** → header must be `Authorization: Bearer nvapi_live_xxx` (literal `Bearer ` prefix, single space, no quotes).
- **402 insufficient_credits** → use `createTopupAddress` flow in section 5.
- **429 rate_limit_exceeded** → free tier = 10 req/min, 100 req/day. Inspect `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers. Upgrade tier for higher limits.
- **Video stuck at `processing` for >10 min** → call `GET /v1/video/{request_id}` directly. If still processing, RunPod job may have stalled — file an issue.
- **Topup `partially_paid`** → you sent less than `pay_amount`. Send the difference to the same address (charge stays open) or contact support.
- **Browser usage** → **don't bundle the API key into client-side JS**. Always proxy through a server.

---

## 9. Architecture notes

- **Generation backend**: WAN 2.1 on RunPod (A100 80GB).
- **Payment backend**: NOWPayments (NSFW-friendly, no preemptive content filtering, USDT-TRC20 primary).
- **API base URL**: `https://telegram-ai-bot-4esd.onrender.com/v1`.
- **Rate limits per tier**: free (10/min, 100/day), basic (20/min, 500/day), pro (60/min, 2000/day), enterprise (200/min, 100k/day).

---

## 10. Support

- **Bot**: [@MultifulDobi_bot](https://t.me/MultifulDobi_bot)
- **Issues**: [github.com/alkamayo-source/video-api/issues](https://github.com/alkamayo-source/video-api/issues)
