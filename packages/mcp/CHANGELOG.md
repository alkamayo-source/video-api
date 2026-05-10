# @multiful/video-api-mcp

## 0.2.1

### Patch Changes

- 764de7c: Migrated source repo to [alkamayo-source/video-api](https://github.com/alkamayo-source/video-api).
  The SDK and MCP server are now developed in a public, dedicated repository
  separate from the bot/server implementation. No code or API changes — only
  package metadata (`repository`, `homepage`, `bugs`) updated.
- Updated dependencies [764de7c]
  - @multiful/video-api-sdk@0.2.1

## 0.2.0

### Minor Changes

- 1cbf907: Initial public release.

  **SDK** (`@multiful/video-api-sdk`):

  - Zero-runtime-dependency TypeScript client (~6KB ESM, ~6KB CJS)
  - Generated types from OpenAPI 3.1 spec (`docs/openapi.yaml`)
  - `createClient()` factory with full coverage of `/video/*` and `/billing/*` endpoints
  - `waitForVideo()` and `waitForTopup()` polling helpers (standalone exports — webhook-deprecation safe)
  - `ApiError` with typed `code` union for ergonomic catch blocks
  - Browser-safe API key warning, AbortSignal support, custom fetch injection

  **MCP server** (`@multiful/video-api-mcp`):

  - stdio-mode MCP server for Cursor / Claude Desktop / autonomous agents
  - 7 tools: `generate_video`, `wait_for_video`, `get_video_status`, `check_balance`, `list_packages`, `create_topup_address`, `get_topup_status`
  - Image input auto-normalization (file path / URL / base64 / data URI)
  - `wait_for_video` writes MP4 to disk via `output_path` to avoid blowing the LLM context window
  - Configured via `VIDEO_API_KEY` env var

### Patch Changes

- Updated dependencies [1cbf907]
  - @multiful/video-api-sdk@0.2.0
