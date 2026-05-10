# CLAUDE.md — Multiful Video API (SDK + MCP + Docs)

> This is the **public** repository for the Multiful Video API client packages.
> The actual API server is operated separately and not in this repo.

---

## 📍 Snapshot

| 항목              | 값                                                               |
| ----------------- | ---------------------------------------------------------------- |
| 최종 업데이트     | 2026-05-11                                                       |
| 공개 패키지       | `@multiful/video-api-sdk@0.2.1`, `@multiful/video-api-mcp@0.2.1` |
| API 서버 base URL | `https://telegram-ai-bot-4esd.onrender.com/v1`                   |
| 결제 레일         | NOWPayments USDT-TRC20 (primary)                                 |
| OpenAPI 버전      | 3.1 ([openapi.yaml](./openapi.yaml))                             |

---

## 🎯 이 리포의 역할

| 패키지 / 파일   | 역할                                                                             |
| --------------- | -------------------------------------------------------------------------------- |
| `packages/sdk/` | `@multiful/video-api-sdk` — Zero-deps TypeScript 클라이언트 (~6KB ESM/CJS)       |
| `packages/mcp/` | `@multiful/video-api-mcp` — Cursor/Claude Desktop 용 MCP server (stdio, 7 tools) |
| `openapi.yaml`  | API 스펙 (서버에서 미러링)                                                       |
| `README.md`     | Quickstart — 사용자/에이전트 5분 통합 가이드                                     |

**비범위**: API 서버 코드, DB 마이그레이션, 결제 처리 로직, 봇 코드 — 별도 운영 환경에 있음.

---

## 🏗️ 아키텍처 결정

### SDK

- **`openapi-typescript` (타입만) + 손으로 쓴 ~80줄 fetch 래퍼**
- Zero runtime dependencies — Node 18+ 네이티브 fetch 사용
- 빌드: `tsup` (ESM + CJS + .d.ts 한 번에)
- 핵심 export: `createClient`, `waitForVideo`, `waitForTopup`, `ApiError`, `ErrorCode`
- 생성 타입은 `src/generated/schema.ts` 커밋 (CI staleness 검사)

### MCP server

- `@modelcontextprotocol/sdk` v1.x `McpServer.registerTool()` API 사용
- SDK에 npm dependency (`^0.2.1`)
- 7 tools: `generate_video`, `wait_for_video`, `get_video_status`, `check_balance`, `list_packages`, `create_topup_address`, `get_topup_status`
- `image` 입력 자동 정규화 (file path / URL / base64 / data URI) — `src/image.ts`
- **`wait_for_video`는 `output_path`로 디스크에 직접 쓰기** — base64 비디오를 LLM context에 넣지 않음 (5sec 480p ≈ 2-4MB)
- 환경변수: `VIDEO_API_KEY` 필수, `VIDEO_API_BASE_URL` 선택

### 핵심 구성 결정

- **npm bin path**: `dist/index.js` (NOT `./dist/index.js` — npm pkg fix가 prefix 제거)
- **`workspace:*` 사용 금지** → npm은 미지원, `^x.y.z` 사용
- **`openapi-typescript --default-non-nullable false` 필수** — v7 default 동작이 client SDK용으로 부적절
- **License**: MIT (둘 다)

---

## 🚀 개발 워크플로우

```bash
# 의존성 설치
npm install --legacy-peer-deps

# 타입 생성 (openapi.yaml → schema.ts)
npm run gen:types

# 빌드 (양쪽 패키지)
npm run build

# 타입체크
npm run typecheck

# 테스트 (SDK only, vitest + msw)
npm test

# OpenAPI 변경 후 SDK 타입 동기화
npm run gen:types
git diff packages/sdk/src/generated/  # 변경 확인
```

### 수정 후 릴리즈 흐름

1. 코드 변경
2. `npx changeset` → 변경 설명 입력 (patch/minor/major)
3. PR 생성 + 머지
4. main 머지 시 release.yml이 "Version Packages" PR 자동 생성
5. 그 PR 머지 → npm 자동 배포

---

## 🛠️ CI / Release

| 워크플로우                         | 트리거           | 역할                                          |
| ---------------------------------- | ---------------- | --------------------------------------------- |
| `.github/workflows/sdk-mcp-ci.yml` | push to main, PR | 타입 staleness 검사 + 빌드 + 테스트 + dry-run |
| `.github/workflows/release.yml`    | push to main     | Changesets PR 자동 생성 / 머지 시 npm publish |

### 필요한 secret

- `NPM_TOKEN`: Granular access token, scope `@multiful`, **bypass 2FA 체크**, Read+Write
  - `NODE_AUTH_TOKEN`도 같은 값 (release.yml에서 둘 다 set)

### 알려진 함정 (이미 해결됨, 재발 방지)

1. **404 on first publish** → `actions/setup-node@v4`의 `registry-url`이 `_authToken=${NODE_AUTH_TOKEN}` 자동 작성. `NODE_AUTH_TOKEN` env 안 주면 placeholder가 빈 값 → 인증 실패. release.yml에 둘 다 명시적으로 설정됨.
2. **Granular Token 2FA** → 토큰 생성 시 "Bypass two-factor authentication" 체크박스 필수.
3. **`workspace:*` 거부** → npm은 미지원. `^0.2.1` 같은 버전 범위 사용.
4. **Ignore 항목 오류** → `.changeset/config.json`의 `ignore` 배열은 워크스페이스 멤버만 가능. 비-멤버 패키지명 넣으면 ValidationError.

---

## 📦 npm 게시 상태

```
@multiful/video-api-sdk@0.2.1    https://www.npmjs.com/package/@multiful/video-api-sdk
@multiful/video-api-mcp@0.2.1    https://www.npmjs.com/package/@multiful/video-api-mcp
```

설치:

```bash
npm install @multiful/video-api-sdk
npx -y @multiful/video-api-mcp  # MCP 서버 직접 실행
```

---

## 🔌 Quickstart 요약

자세한 건 [README.md](./README.md) 참조. 핵심만:

```ts
import { createClient, waitForVideo } from "@multiful/video-api-sdk";
const api = createClient({ apiKey: process.env.VIDEO_API_KEY! });
const job = await api.video.generate({
  image: base64,
  template: "tops_remove",
});
const result = await waitForVideo(api, job.request_id);
```

MCP (Cursor/Claude Desktop):

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

API 키 발급: Telegram [@MultifulDobi_bot](https://t.me/MultifulDobi_bot)에 `/apikey email@example.com`

---

## ⏳ Pending / Known Gaps

### High priority

- [ ] **HTTP signup 엔드포인트** — 현재 키 발급은 Telegram 봇 전용. 자율 에이전트는 셀프서브 불가. 서버 측에 `POST /v1/auth/signup` 추가 필요 (free 0 credits, 충전 후 사용 모델).
- [ ] **NOWPayments live test** — 가입/IPN/Render env 셋업 끝나면 본인 USDT $10 입금해서 흐름 검증.
- [ ] **Cursor/Claude Desktop 통합 smoke test** — `npx -y @multiful/video-api-mcp` 실제 클라이언트에서 동작 확인.

### Medium priority

- [ ] **MCP 레지스트리 등록** — smithery.ai, mcp.so, modelcontextprotocol/servers PR. 노출 채널.
- [ ] **Examples 디렉토리** — `examples/ts/`, `examples/python/` (curl), `examples/agent/` (loop + auto top-up).
- [ ] **Reference 문서 분리** — README가 길어지면 `docs/reference.md`, `docs/templates.md` 등으로 분리.

### Low priority / future

- [ ] **x402 protocol** (Phase 2) — Coinbase 진영 호출당 결제 표준. USDC on Base 기반.
- [ ] **Python SDK** — TypeScript 외 언어. 수요 보고 결정.
- [ ] **자체 hot wallet** — NOWPayments 의존 제거. 트래픽 검증 후.

---

## 🔐 보안 / 운영 노트

- npm token은 `@multiful` org owner 계정에 한정 발급. 외부 노출 금지.
- 이 리포는 **public** — 절대 시크릿 (API key, IPN secret, DB credential) 커밋 X.
- `.gitignore`에 `.env`, `node_modules`, `dist` 모두 포함.
- README/CLAUDE.md에 운영 인프라(Supabase URL, Render service ID 등) 명시 X. base URL만 (이미 OpenAPI에 공개).

---

## 📞 참고 링크

- npm: [@multiful/video-api-sdk](https://www.npmjs.com/package/@multiful/video-api-sdk), [@multiful/video-api-mcp](https://www.npmjs.com/package/@multiful/video-api-mcp)
- Repo: [github.com/alkamayo-source/video-api](https://github.com/alkamayo-source/video-api)
- Issues: [github.com/alkamayo-source/video-api/issues](https://github.com/alkamayo-source/video-api/issues)
- API 키 발급: Telegram [@MultifulDobi_bot](https://t.me/MultifulDobi_bot)
