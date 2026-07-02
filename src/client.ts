import type {
  FetchLike,
  RecentResponse,
  RektRadarOptions,
  RugsResponse,
  StatsResponse,
  TokenFull,
  TokenVerdict,
  TrendsOptions,
  TrendsResponse,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://api.rektradar.io";

// SDK version, sent as a User-Agent so API usage from the SDK is attributable
// in server logs (vs raw curl / browser fetch). Keep in sync with package.json
// on each release. In browsers `User-Agent` is a forbidden header and is
// silently dropped (no error); it takes effect in Node/undici, which is where
// real server-side integrations live.
const SDK_VERSION = "0.1.9";

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
    // Bind the global fetch to globalThis. In browsers, calling a detached
    // `window.fetch` reference (which is what we store in this.fetchImpl) throws
    // "Illegal invocation"; Node's global fetch doesn't care, but binding is
    // safe in both. Without this, `new RektRadar()` is unusable client-side.
    const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
    const resolved = options.fetch ?? (globalFetch ? globalFetch.bind(globalThis) : undefined);
    if (!resolved) {
      throw new Error(
        "No fetch implementation available. Pass options.fetch (Node <18 or a non-standard runtime).",
      );
    }
    this.fetchImpl = resolved;
  }

  private async get<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": `rektradar-sdk/${SDK_VERSION}`,
    };
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

  /**
   * Trends time-series: new scam pools / analyses bucketed over time.
   * `daily`/`weekly` are historical aggregates (real-time for everyone);
   * `hourly` is the live pulse - on a free key the current in-progress hour is
   * withheld (dataDelaySeconds ~600), real-time on a paid key.
   */
  trends(options: TrendsOptions = {}): Promise<TrendsResponse> {
    const params = new URLSearchParams();
    if (options.period) { params.set("period", options.period); }
    if (options.granularity) { params.set("granularity", options.granularity); }
    const query = params.toString();
    return this.get<TrendsResponse>(`/v1/trends${query ? `?${query}` : ""}`);
  }

  /** Top scam deployers (leaderboard, real-time). */
  topDeployers(limit = 20): Promise<unknown> {
    return this.get(`/v1/deployers/top?limit=${encodeURIComponent(String(limit))}`);
  }

  /** Platform-wide aggregate counters (tokens scanned, scams, deployers). Real-time for all tiers. */
  stats(): Promise<StatsResponse> {
    return this.get<StatsResponse>("/v1/stats");
  }
}
