/**
 * Live event stream (WebSocket) for the RektRadar API.
 *
 * Subscribes to the real-time intel flow: new tokens, fresh scores, rug
 * detections. Free keys receive events on a ~10 min delay; paid keys receive
 * them live. Runtime-agnostic: uses the global WebSocket in browsers; in Node
 * pass the `ws` package via options.WebSocket.
 *
 * @example
 * import WebSocket from "ws";
 * const handle = connectStream({
 *   apiKey: process.env.REKTRADAR_KEY,
 *   events: ["new_token", "rug"],
 *   WebSocket,
 *   onMessage: (e) => console.log(e.type, e.data),
 * });
 * // later: handle.close();
 */

export interface StreamEvent {
  type: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface WebSocketLike {
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
  close(): void;
}

export type WebSocketCtor = new (url: string) => WebSocketLike;

export interface StreamOptions {
  /** API key. Omit for anonymous free access (events arrive delayed). */
  apiKey?: string;
  /** Override the stream origin. Default: wss://api.rektradar.io */
  baseUrl?: string;
  /** Optional event-type filter, e.g. ["new_token", "rug"]. */
  events?: string[];
  onMessage: (event: StreamEvent) => void;
  onOpen?: () => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
  /** WebSocket constructor. Node: pass the 'ws' package. Defaults to global WebSocket. */
  WebSocket?: WebSocketCtor;
}

export interface StreamHandle {
  close(): void;
}

const DEFAULT_WS_BASE = "wss://api.rektradar.io";

/** Build the authenticated stream URL (http/https bases are upgraded to ws/wss). */
export function streamUrl(baseUrl: string, apiKey?: string, events?: string[]): string {
  const base = baseUrl.replace(/\/+$/, "").replace(/^http/, "ws");
  const params = new URLSearchParams();
  if (apiKey) {
    params.set("api_key", apiKey);
  }
  if (events && events.length > 0) {
    params.set("events", events.join(","));
  }
  const query = params.toString();
  return `${base}/v1/stream${query ? `?${query}` : ""}`;
}

/** Connect to the live event stream. Returns a handle to close the socket. */
export function connectStream(options: StreamOptions): StreamHandle {
  const Ctor = options.WebSocket ?? (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  if (!Ctor) {
    throw new Error(
      "No WebSocket implementation available. Pass options.WebSocket (Node: the 'ws' package).",
    );
  }
  const url = streamUrl(options.baseUrl ?? DEFAULT_WS_BASE, options.apiKey, options.events);
  const socket = new Ctor(url);

  socket.addEventListener("open", () => options.onOpen?.());
  socket.addEventListener("message", (event) => {
    let parsed: StreamEvent;
    try {
      const raw = typeof event.data === "string" ? event.data : String(event.data ?? "");
      parsed = JSON.parse(raw) as StreamEvent;
    } catch {
      return; // ignore non-JSON frames (pings, etc.)
    }
    options.onMessage(parsed);
  });
  socket.addEventListener("error", (event) => options.onError?.(event));
  socket.addEventListener("close", () => options.onClose?.());

  return { close: () => socket.close() };
}
