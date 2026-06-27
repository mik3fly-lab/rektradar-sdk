import { describe, it, expect } from "vitest";
import * as sdk from "./index.js";
import {
  RektRadar,
  DEFAULT_BASE_URL,
  connectStream,
  streamUrl,
  verifyWebhook,
} from "./index.js";
import type { FetchLike } from "./types.js";

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
