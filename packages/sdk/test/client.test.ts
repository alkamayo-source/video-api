import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createClient, ApiError, waitForVideo } from "../src/index";

const BASE = "https://api.test/v1";
const KEY = "nvapi_live_" + "a".repeat(64);

let videoStatusPolls = 0;

const server = setupServer(
  http.get(`${BASE}/billing/balance`, ({ request }) => {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${KEY}`) {
      return HttpResponse.json({ error: "unauthorized", message: "bad token" }, { status: 401 });
    }
    return HttpResponse.json({
      credits_balance: 1234,
      credits_used: 56,
      tier: "pro",
    });
  }),

  http.post(`${BASE}/video/generate`, async ({ request }) => {
    const body = (await request.json()) as { image?: string };
    if (!body.image) {
      return HttpResponse.json(
        { error: "invalid_request", message: "image required" },
        { status: 400 },
      );
    }
    return HttpResponse.json(
      {
        request_id: "req_abc123",
        status: "processing",
        credits_charged: 35,
        estimated_time_seconds: 120,
        message: "ok",
      },
      { status: 202 },
    );
  }),

  http.get(`${BASE}/video/req_abc123`, () => {
    videoStatusPolls++;
    if (videoStatusPolls < 2) {
      return HttpResponse.json({
        request_id: "req_abc123",
        status: "processing",
        created_at: "2026-05-10T00:00:00Z",
      });
    }
    return HttpResponse.json({
      request_id: "req_abc123",
      status: "completed",
      video: "ZmFrZV92aWRlbw==",
      metadata: { width: 480, height: 832, frames: 97, fps: 32, duration: "3.03s" },
      created_at: "2026-05-10T00:00:00Z",
      completed_at: "2026-05-10T00:02:00Z",
      processing_time_ms: 120000,
    });
  }),

  http.post(`${BASE}/billing/topup-address`, async ({ request }) => {
    const body = (await request.json()) as { package?: string; pay_currency?: string };
    if (body.package === "growth") {
      return HttpResponse.json(
        {
          payment_id: "5077125051",
          pay_address: "TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          pay_amount: 50.0,
          pay_currency: body.pay_currency ?? "usdttrc20",
          amount_usd: 50,
          credits: 6000,
          bonus_percent: 20,
          expires_at: "2026-05-10T01:14:00Z",
          order_id: "topup_test_1",
          message: "Send exactly 50 USDTTRC20",
        },
        { status: 201 },
      );
    }
    return HttpResponse.json({ error: "invalid_package", message: "bad package" }, { status: 400 });
  }),

  http.get(`${BASE}/billing/topup-status/:id`, ({ params }) => {
    return HttpResponse.json({
      payment_id: params.id,
      payment_status: "finished",
      pay_address: "TXxx",
      pay_amount: 50,
      actually_paid: 50,
      pay_currency: "usdttrc20",
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  videoStatusPolls = 0;
});
afterAll(() => server.close());

describe("createClient", () => {
  it("calls /billing/balance with Bearer auth", async () => {
    const api = createClient({ apiKey: KEY, baseUrl: BASE });
    const bal = await api.billing.balance();
    expect(bal.credits_balance).toBe(1234);
    expect(bal.tier).toBe("pro");
  });

  it("throws ApiError with code on 401", async () => {
    const api = createClient({ apiKey: "nvapi_live_" + "z".repeat(64), baseUrl: BASE });
    await expect(api.billing.balance()).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      code: "unauthorized",
    });
  });

  it("submits a video generation job", async () => {
    const api = createClient({ apiKey: KEY, baseUrl: BASE });
    const job = await api.video.generate({ image: "fake_b64" });
    expect(job.request_id).toBe("req_abc123");
    expect(job.credits_charged).toBe(35);
  });

  it("rejects video generate with missing image", async () => {
    const api = createClient({ apiKey: KEY, baseUrl: BASE });
    await expect(api.video.generate({ image: "" })).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
    });
  });

  it("creates a topup address for growth package", async () => {
    const api = createClient({ apiKey: KEY, baseUrl: BASE });
    const dep = await api.billing.createTopupAddress({
      package: "growth",
      pay_currency: "usdttrc20",
    });
    expect(dep.pay_amount).toBe(50);
    expect(dep.credits).toBe(6000);
    expect(dep.pay_address).toMatch(/^T/);
  });

  it("rejects invalid package", async () => {
    const api = createClient({ apiKey: KEY, baseUrl: BASE });
    await expect(
      // @ts-expect-error — testing runtime validation behavior
      api.billing.createTopupAddress({ package: "bogus" }),
    ).rejects.toMatchObject({ code: "invalid_package", status: 400 });
  });
});

describe("waitForVideo", () => {
  it("polls until completed", async () => {
    const api = createClient({ apiKey: KEY, baseUrl: BASE });
    const result = await waitForVideo(api, "req_abc123", { intervalMs: 10, timeoutMs: 5000 });
    expect(result.status).toBe("completed");
    expect(result.video).toBe("ZmFrZV92aWRlbw==");
    expect(videoStatusPolls).toBe(2);
  });

  it("times out if never completes", async () => {
    server.use(
      http.get(`${BASE}/video/req_stuck`, () =>
        HttpResponse.json({
          request_id: "req_stuck",
          status: "processing",
          created_at: "2026-05-10T00:00:00Z",
        }),
      ),
    );
    const api = createClient({ apiKey: KEY, baseUrl: BASE });
    await expect(
      waitForVideo(api, "req_stuck", { intervalMs: 5, timeoutMs: 30 }),
    ).rejects.toMatchObject({ name: "ApiError" });
  });

  it("respects AbortSignal", async () => {
    server.use(
      http.get(`${BASE}/video/req_abort`, () =>
        HttpResponse.json({
          request_id: "req_abort",
          status: "processing",
          created_at: "2026-05-10T00:00:00Z",
        }),
      ),
    );
    const api = createClient({ apiKey: KEY, baseUrl: BASE });
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20);
    await expect(
      waitForVideo(api, "req_abort", { intervalMs: 50, signal: ctrl.signal }),
    ).rejects.toMatchObject({ name: "ApiError" });
  });
});
