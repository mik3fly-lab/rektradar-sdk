import type {
  FetchLike,
  RecentResponse,
  RektRadarOptions,
  RugsResponse,
  TokenFull,
  TokenVerdict,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://app.rektradar.io";

/** Thrown on a non-2xx API response. */
export class RektRadarError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RektRadarError";
    this.status = status;
  }
}

/**
 * Client for the RektRadar public API.
 *
 * Freshness model: targeted token lookups are real-time for everyone; the
 * recent-activity flow (rugs, recent analyses) is delayed ~10 min on a free
 * key and real-time on a paid key. Each flow response carries dataDelaySeconds.
 *
 * @example
 * const rr = new RektRadar({ apiKey: process.env.REKTRADAR_KEY });
 * const verdict = await rr.token("0x...");
 * if (verdict.score >= 70) console.warn("high risk", verdict.flags);
 */
export class RektRadar {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: RektRadarOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const resolved = options.fetch ?? (globalThis as { fetch?: FetchLike }).fetch;
    if (!resolved) {
      throw new Error(
        "No fetch implementation available. Pass options.fetch (Node <18 or a non-standard runtime).",
      );
    }
    this.fetchImpl = resolved;
  }

  private async get<T>(path: string): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { method: "GET", headers });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body && typeof body.error === "string") {
          message = body.error;
        }
      } catch {
        /* non-JSON error body */
      }
      throw new RektRadarError(res.status, message);
    }
    return (await res.json()) as T;
  }

  /** Real-time risk verdict (score + flags) for a token. */
  token(address: string): Promise<TokenVerdict> {
    return this.get<TokenVerdict>(`/v1/token/${encodeURIComponent(address)}`);
  }

  /** Real-time deep view: verdict + liquidity + holders. */
  tokenFull(address: string): Promise<TokenFull> {
    return this.get<TokenFull>(`/v1/token/${encodeURIComponent(address)}/full`);
  }

  /** Recent rug pulls. Delayed ~10 min on a free key, real-time on a paid key. */
  rugs(options: { since?: string } = {}): Promise<RugsResponse> {
    const query = options.since ? `?since=${encodeURIComponent(options.since)}` : "";
    return this.get<RugsResponse>(`/v1/rugs${query}`);
  }

  /** Recent analyses feed. Delayed ~10 min on free, real-time on paid. */
  recent(): Promise<RecentResponse> {
    return this.get<RecentResponse>("/v1/recent");
  }

  /** Top scam deployers (leaderboard, real-time). */
  topDeployers(limit = 20): Promise<unknown> {
    return this.get(`/v1/deployers/top?limit=${encodeURIComponent(String(limit))}`);
  }
}
