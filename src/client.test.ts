import { describe, it, expect, vi } from "vitest";
import { RektRadar, RektRadarError } from "./client.js";
import type { FetchLike, HttpResponse } from "./types.js";

function mockResponse(body: unknown, ok = true, status = 200): HttpResponse {
  return { ok, status, json: async () => body, headers: { get: () => null } };
}

describe("RektRadar", () => {
  it("sends the API key as a Bearer header on token()", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({ address: "0xABC", score: 80, flags: ["hidden_mint"] }),
    );
    const rr = new RektRadar({ apiKey: "rr_live_k", fetch: fetchImpl });
    const verdict = await rr.token("0xABC");
    expect(verdict.score).toBe(80);
    const call = fetchImpl.mock.calls[0]!;
    expect(call[0]).toBe("https://api.rektradar.io/v1/token/0xABC");
    expect(call[1]?.headers?.Authorization).toBe("Bearer rr_live_k");
  });

  it("omits the Authorization header when anonymous", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({ rugs: [], summary: null, dataDelaySeconds: 600 }),
    );
    const rr = new RektRadar({ fetch: fetchImpl });
    const out = await rr.rugs();
    expect(out.dataDelaySeconds).toBe(600);
    expect(fetchImpl.mock.calls[0]![1]?.headers?.Authorization).toBeUndefined();
  });

  it("sends a rektradar-sdk User-Agent for server-log attribution", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({ address: "0xABC", score: 1, flags: [] }),
    );
    const rr = new RektRadar({ fetch: fetchImpl });
    await rr.token("0xABC");
    const ua = fetchImpl.mock.calls[0]![1]?.headers?.["User-Agent"];
    expect(ua).toMatch(/^rektradar-sdk\/\d/);
  });

  it("passes the since param to rugs()", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({ rugs: [], summary: null, dataDelaySeconds: 0 }),
    );
    const rr = new RektRadar({ apiKey: "rr_live_k", fetch: fetchImpl });
    await rr.rugs({ since: "7d" });
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://api.rektradar.io/v1/rugs?since=7d");
  });

  it("hits /v1/trends with no query when trends() has no options", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({ trends: [], granularity: "daily", period: "7d", dataDelaySeconds: 0 }),
    );
    const rr = new RektRadar({ fetch: fetchImpl });
    const out = await rr.trends();
    expect(out.granularity).toBe("daily");
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://api.rektradar.io/v1/trends");
  });

  it("passes period + granularity to trends()", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({ trends: [], granularity: "hourly", period: "6h", dataDelaySeconds: 600 }),
    );
    const rr = new RektRadar({ apiKey: "rr_live_k", fetch: fetchImpl });
    const out = await rr.trends({ period: "6h", granularity: "hourly" });
    expect(out.dataDelaySeconds).toBe(600);
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://api.rektradar.io/v1/trends?period=6h&granularity=hourly");
  });

  it("hits /v1/stats and returns the platform counters", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({ tokensScanned: 1000, scamsDetected: 400, deployersMapped: 300, ts: "2026-06-27T00:00:00.000Z" }),
    );
    const rr = new RektRadar({ fetch: fetchImpl });
    const out = await rr.stats();
    expect(out.tokensScanned).toBe(1000);
    expect(out.scamsDetected).toBe(400);
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://api.rektradar.io/v1/stats");
  });

  it("hits /v1/token/:address/full and surfaces the swap signals", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({
        score: { address: "0xABC", score: 80, flags: [] },
        liquidity: {},
        holders: {},
        swaps: { traders: 169, buys: 11794, sells: 3958, buyVolWeth: 29.33, sellVolWeth: 29.74, netLiquidityWeth: -12.91, quote: "WETH" },
      }),
    );
    const rr = new RektRadar({ apiKey: "rr_live_k", fetch: fetchImpl });
    const full = await rr.tokenFull("0xABC");
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://api.rektradar.io/v1/token/0xABC/full");
    expect(full.swaps?.traders).toBe(169);
    expect(full.swaps?.netLiquidityWeth).toBe(-12.91);
  });

  it("tolerates swaps=null on token/full (base/quote tokens)", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({ score: {}, liquidity: {}, holders: {}, swaps: null }),
    );
    const rr = new RektRadar({ fetch: fetchImpl });
    const full = await rr.tokenFull("0xweth");
    expect(full.swaps).toBeNull();
  });

  it("throws RektRadarError carrying the upstream message on non-2xx", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({ error: "Rate limit exceeded" }, false, 429),
    );
    const rr = new RektRadar({ apiKey: "rr_live_k", fetch: fetchImpl });
    await expect(rr.token("0x1")).rejects.toBeInstanceOf(RektRadarError);
    await expect(rr.token("0x1")).rejects.toMatchObject({ status: 429, message: "Rate limit exceeded" });
  });

  it("strips a trailing slash from baseUrl", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(
      mockResponse({ address: "0x1", score: 0, flags: [] }),
    );
    const rr = new RektRadar({ baseUrl: "http://localhost:3014/", fetch: fetchImpl });
    await rr.token("0x1");
    expect(fetchImpl.mock.calls[0]![0]).toBe("http://localhost:3014/v1/token/0x1");
  });

  it("throws when no fetch implementation is available", () => {
    const original = (globalThis as { fetch?: unknown }).fetch;
    delete (globalThis as { fetch?: unknown }).fetch;
    try {
      expect(() => new RektRadar()).toThrow(/fetch/);
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
  });

  it("binds the default global fetch (browser rejects a detached call)", async () => {
    // Browsers throw "Illegal invocation" when window.fetch is called detached
    // from window. Mimic that strictness and confirm the SDK binds the default.
    const original = (globalThis as { fetch?: unknown }).fetch;
    const strict = function (this: unknown): Promise<HttpResponse> {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(mockResponse({ address: "0x1", score: 0, flags: [] }));
    };
    (globalThis as { fetch?: unknown }).fetch = strict;
    try {
      const rr = new RektRadar(); // no fetch passed -> must bind the global one
      await expect(rr.token("0x1")).resolves.toMatchObject({ address: "0x1" });
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
  });
});
