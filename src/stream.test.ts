import { describe, it, expect, vi } from "vitest";
import { streamUrl, connectStream } from "./stream.js";
import type { WebSocketLike } from "./stream.js";

describe("streamUrl", () => {
  it("builds a wss URL with api_key + events from an https base", () => {
    expect(streamUrl("https://api.rektradar.io", "rr_live_k", ["new_token", "rug"])).toBe(
      "wss://api.rektradar.io/v1/stream?api_key=rr_live_k&events=new_token%2Crug",
    );
  });

  it("omits the query when no key/events are given", () => {
    expect(streamUrl("wss://api.rektradar.io")).toBe("wss://api.rektradar.io/v1/stream");
  });
});

describe("connectStream", () => {
  it("connects with an injected WebSocket and parses JSON frames", () => {
    const listeners: Record<string, (event: { data?: unknown }) => void> = {};
    const closeSpy = vi.fn();
    class FakeWS implements WebSocketLike {
      constructor(public url: string) {}
      addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
        listeners[type] = listener;
      }
      close(): void {
        closeSpy();
      }
    }

    const onMessage = vi.fn();
    const handle = connectStream({ apiKey: "rr_live_k", onMessage, WebSocket: FakeWS });

    listeners.message?.({ data: JSON.stringify({ type: "new_token", data: { address: "0x1" } }) });
    expect(onMessage).toHaveBeenCalledWith({ type: "new_token", data: { address: "0x1" } });

    listeners.message?.({ data: "not-json" }); // ignored, no throw
    expect(onMessage).toHaveBeenCalledTimes(1);

    handle.close();
    expect(closeSpy).toHaveBeenCalled();
  });
});
