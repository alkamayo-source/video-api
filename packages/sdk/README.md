# @multiful/video-api-sdk

TypeScript SDK for the Multiful Video API. Designed for **autonomous AI agents** (Cursor, Claude Desktop, OpenAI Agents) and human developers.

- Zero runtime dependencies — uses native `fetch` (Node 18+, browsers, Deno, Bun, Cloudflare Workers)
- Fully typed end-to-end from OpenAPI 3.1 spec
- ~6 KB ESM bundle, tree-shakable
- Polling helpers (`waitForVideo`, `waitForTopup`) for synchronous-feeling async workflows
- Crypto top-up via USDT-TRC20 (autonomous, no human checkout)

## Install

```bash
npm install @multiful/video-api-sdk
```

## Get an API key

Send `/apikey your@email.com` to [@MultifulDobi_bot](https://t.me/MultifulDobi_bot) on Telegram. Free tier includes 10 credits.

## Quickstart

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

## API surface

```ts
api.video.generate(req)
api.video.status(requestId)

api.billing.balance()
api.billing.packages()
api.billing.currencies()
api.billing.createTopupAddress({ package, pay_currency? })
api.billing.topupStatus(paymentId)
api.billing.deposits({ limit?, offset? })
api.billing.history({ limit?, offset? })

api.health()
api.raw<T>(method, path, body?)   // escape hatch
```

## Autonomous top-up (no human in the loop)

```ts
const dep = await api.billing.createTopupAddress({
  package: "growth", // 6,000 credits ($50 USD)
  pay_currency: "usdttrc20",
});
// Agent's wallet sends EXACTLY dep.pay_amount USDT-TRC20 to dep.pay_address.
// Credits land within ~1-3 minutes of on-chain confirmation.

await waitForTopup(api, dep.payment_id);
const balance = await api.billing.balance();
```

> **Send the exact `pay_amount`.** Underpayment results in `partially_paid` and credits are NOT granted.

## Error handling

```ts
import { ApiError } from "@multiful/video-api-sdk";

try {
  await api.video.generate({ image });
} catch (e) {
  if (e instanceof ApiError) {
    if (e.code === "insufficient_credits") {
      // top up via createTopupAddress, then retry
    } else if (e.code === "rate_limit_exceeded") {
      // back off using e.details
    }
  }
}
```

## Memory note: video size

A 5-second 480p video is roughly **2-4 MB base64** in memory. The `video` field on the success response holds this inline. Decode and stream to disk if you don't want it in RAM.

## Browser usage

API keys must **not** be embedded in client-side bundles. The SDK warns when it detects `nvapi_live_*` running in a `window` context, but always proxy through your own server in production.

## Related packages

- **[@multiful/video-api-mcp](https://npmjs.com/package/@multiful/video-api-mcp)** — MCP server for Cursor / Claude Desktop, depends on this SDK.
- **[OpenAPI spec](https://github.com/alkamayo-source/video-api/blob/main/openapi.yaml)** — full API specification.
- **[Quickstart](https://github.com/alkamayo-source/video-api/blob/main/README.md)** — 5-minute getting-started guide.

## License

MIT
