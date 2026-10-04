import { describe, it, expect } from "vitest";
import * as sdk from "./index.js";
import {
  RektRadar,
  DEFAULT_BASE_URL,
  connectStream,
  streamUrl,
  verifyWebhook,
} from "./index.js";
import type { FetchLike, RecentItem, RecentResponse, StatsResponse, TrendsResponse } from "./types.js";

// The README, the rektradar.io/developers page and the dev.to article all
// reference this surface by hand. When a public name is renamed or removed,
// nothing in those hand-written examples fails until a developer copy-pastes
// them and gets a runtime error (this is exactly how `rr.stream()` shipped in
// the docs while the SDK only ever exposed `connectStream`). These tests pin
// the contract so a breaking change fails CI here instead of in someone's bot.

const noopFetch: FetchLike = async () => ({
  ok: true,
  status: 200,
  json: async () => ({}),
  headers: { get: () => null },
});

describe("public API surface", () => {
  it("exports exactly the documented runtime members", () => {
    expect(Object.keys(sdk).sort()).toEqual(
      [
        "DEFAULT_BASE_URL",
        "RektRadar",
        "RektRadarError",
        "connectStream",
        "streamUrl",
        "verifyWebhook",
      ].sort(),
    );
  });

  it("exposes the documented RektRadar methods", () => {
    const rr = new RektRadar({ apiKey: "rr_test", fetch: noopFetch });
    const surface = rr as unknown as Record<string, unknown>;
    for (const method of ["token", "tokenFull", "rugs", "recent", "topDeployers", "trends", "stats"]) {
      expect(typeof surface[method]).toBe("function");
    }
  });

  it("has no streaming method on the client (streaming is connectStream)", () => {
    // The docs once wrote `rr.stream(...)`, which never existed. Streaming is a
    // standalone `connectStream()` export. Guard against the mistake returning.
    const rr = new RektRadar({ apiKey: "rr_test", fetch: noopFetch });
    expect((rr as unknown as Record<string, unknown>).stream).toBeUndefined();
    expect(typeof connectStream).toBe("function");
    expect(typeof streamUrl).toBe("function");
    expect(typeof verifyWebhook).toBe("function");
  });

  it("defaults to the canonical api.rektradar.io host, never app.", () => {
    expect(DEFAULT_BASE_URL).toBe("https://api.rektradar.io");
    expect(DEFAULT_BASE_URL).not.toContain("app.rektradar.io");

    // The WebSocket origin must also be api. (the base-URL bug pointed both the
    // REST client and the stream at app.rektradar.io). connectStream defaults to
    // wss://api.rektradar.io when no baseUrl is passed.
    let openedUrl = "";
    class CaptureSocket {
      constructor(url: string) {
        openedUrl = url;
      }
      addEventListener() {}
      removeEventListener() {}
      close() {}
    }
    connectStream({
      apiKey: "rr_test",
      events: ["rug"],
      onMessage: () => {},
      WebSocket: CaptureSocket as unknown as never,
    });
    expect(openedUrl.startsWith("wss://api.rektradar.io")).toBe(true);
    expect(openedUrl).not.toContain("app.rektradar.io");
  });
});

// GET /v1/recent: the server half is rektradar-app tests/contracts/v1-contracts.test.ts.
describe("recent() contract", () => {
  // A /v1/recent body as served since the feed is ordered by discovery.
  const body: RecentResponse = {
    items: [
      {
        address: "0x1111111111111111111111111111111111111111",
        symbol: "NEW",
        riskScore: 70,
        // Discovered 30 min ago, re-analysed a minute ago: still a 30-min-old token.
        createdAt: "2026-10-04T15:30:00.000Z",
        analyzedAt: "2026-10-04T15:59:00.000Z",
      },
      {
        address: "0x2222222222222222222222222222222222222222",
        symbol: "OLDER",
        riskScore: 10,
        createdAt: "2026-10-04T15:20:00.000Z",
        analyzedAt: "2026-10-04T15:20:02.000Z",
      },
    ],
    dataDelaySeconds: 600,
  };
  const fetchBody: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => body,
    headers: { get: () => null },
  });

  it("returns { items, dataDelaySeconds } with createdAt (discovery) and analyzedAt (last analysis) on every item", async () => {
    const out = await new RektRadar({ fetch: fetchBody }).recent();
    expect(Object.keys(out).sort()).toEqual(["dataDelaySeconds", "items"]);
    for (const item of out.items) {
      // Typed reads: RecentItem declares these (an index-signature field would be `unknown`).
      const address: string = item.address;
      const createdAt: string | null | undefined = item.createdAt;
      const analyzedAt: string | null = item.analyzedAt;
      expect(address).toMatch(/^0x[0-9a-f]{40}$/);
      expect(Number.isFinite(Date.parse(createdAt ?? ""))).toBe(true);
      expect(Number.isFinite(Date.parse(analyzedAt ?? ""))).toBe(true);
    }
  });

  it("items come newest createdAt first; analyzedAt is not the order", async () => {
    const { items } = await new RektRadar({ fetch: fetchBody }).recent();
    const created = items.map((i: RecentItem) => Date.parse(i.createdAt ?? ""));
    expect(created).toEqual([...created].sort((a, b) => b - a));
    // The re-analysed first row has the newer analyzedAt but is not ahead because of it.
    expect(Date.parse(items[0]!.analyzedAt ?? "")).toBeGreaterThan(Date.parse(items[0]!.createdAt ?? ""));
  });
});

// GET /v1/trends + /v1/stats: the server half is rektradar-app
// tests/contracts/v1-contracts.test.ts. Same shape since 2026-10-04, new
// meaning: the token counters count DISCOVERED tokens, never re-analyses.
describe("trends() / stats() contract", () => {
  const respond = (payload: unknown): FetchLike => async () => ({
    ok: true,
    status: 200,
    json: async () => payload,
    headers: { get: () => null },
  });

  it("trends() returns { trends, granularity, period, dataDelaySeconds } with typed bucket counters", async () => {
    const body: TrendsResponse = {
      // 2026-10-04: 503 tokens discovered that day, whatever was re-analysed.
      trends: [{ date: "2026-10-04", tokensDetected: 696, tokensAnalyzed: 503, avgRiskScore: 51, honeypotCount: 51 }],
      granularity: "daily",
      period: "7d",
      dataDelaySeconds: 0,
    };
    const out = await new RektRadar({ fetch: respond(body) }).trends({ period: "7d" });
    expect(Object.keys(out).sort()).toEqual(["dataDelaySeconds", "granularity", "period", "trends"]);
    for (const bucket of out.trends) {
      const counters: number[] = [bucket.tokensDetected, bucket.tokensAnalyzed, bucket.avgRiskScore, bucket.honeypotCount];
      for (const n of counters) { expect(typeof n).toBe("number"); }
    }
  });

  it("stats() exposes analyzed24h (tokens discovered in the last 24h) as a number", async () => {
    const body: StatsResponse = {
      tokensScanned: 136181,
      scamsDetected: 84084,
      poolsMonitored: 149368,
      mempoolTxs: 2593994,
      deployersMapped: 54536,
      scamDeployers: 20940,
      networkEdges: 15756091,
      analyzed24h: 653,
      ts: "2026-10-04T18:00:00.000Z",
    };
    const out = await new RektRadar({ fetch: respond(body) }).stats();
    const analyzed24h: number = out.analyzed24h;
    expect(analyzed24h).toBe(653);
  });
});
