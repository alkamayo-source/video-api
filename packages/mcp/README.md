# @multiful/video-api-mcp

MCP server for the Multiful Video API. Plug into Cursor, Claude Desktop, or any [Model Context Protocol](https://modelcontextprotocol.io) client to give your agent video generation + autonomous crypto top-up capabilities.

## Install (1-line setup)

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

> _"Use video-api to generate a video from photo.jpg with template tops_remove, save to out.mp4"_

## Get an API key

Send `/apikey your@email.com` to [@MultifulDobi_bot](https://t.me/MultifulDobi_bot) on Telegram. Free tier includes 10 credits.

## Tools exposed

| Tool                   | Purpose                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `generate_video`       | Submit a video job. `image` accepts file path, http(s) URL, base64, or data URI — auto-normalized.        |
| `wait_for_video`       | Poll until done; with `output_path`, writes MP4 to disk and returns only the path (avoids context bloat). |
| `get_video_status`     | Single status check (no polling).                                                                         |
| `check_balance`        | Current credits / tier.                                                                                   |
| `list_packages`        | Top-up packages.                                                                                          |
| `create_topup_address` | Get USDT-TRC20 deposit address for autonomous credit top-up.                                              |
| `get_topup_status`     | Poll a deposit's confirmation status.                                                                     |

## Important: video file size

`wait_for_video` and `get_video_status` accept an `output_path` argument. **Always provide it** in agent flows — without it, the base64 video (typically 2-4 MB for a 5-sec clip) is returned inline in the tool response, which can blow the LLM context window.

## Environment variables

| Variable             | Required | Description                                                                     |
| -------------------- | -------- | ------------------------------------------------------------------------------- |
| `VIDEO_API_KEY`      | yes      | Your `nvapi_live_xxx` key                                                       |
| `VIDEO_API_BASE_URL` | no       | Override API base URL (default: `https://telegram-ai-bot-4esd.onrender.com/v1`) |

## Autonomous top-up (no human in the loop)

When `check_balance` reports low credits, an agent with crypto wallet access can self-fund:

1. Call `list_packages` → see options (starter $10, standard $25, growth $50, pro $100)
2. Call `create_topup_address` with package + `pay_currency: usdttrc20`
3. Send EXACTLY the returned `pay_amount` of USDT-TRC20 to `pay_address` from your wallet
4. Poll `get_topup_status` with `payment_id` — credits land on `payment_status: "finished"`

## Local development

```bash
git clone https://github.com/alkamayo-source/video-api
cd video-api
npm install --legacy-peer-deps
npm -w @multiful/video-api-sdk run build
npm -w @multiful/video-api-mcp run build
VIDEO_API_KEY=nvapi_live_xxx node packages/mcp/dist/index.js
```

For MCP-protocol-level inspection:

```bash
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js
```

## Related packages

- **[@multiful/video-api-sdk](https://npmjs.com/package/@multiful/video-api-sdk)** — TypeScript SDK (this package depends on it).
- **[Quickstart](https://github.com/alkamayo-source/video-api/blob/main/README.md)** — 5-minute getting-started guide.

## License

MIT
