/** Minimal fetch shape so the SDK stays runtime-agnostic (no DOM/Node lib dependency). */
export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  headers: { get(name: string): string | null };
}

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<HttpResponse>;

export interface RektRadarOptions {
  /** API key (rr_live_...). Omit for anonymous free access (data is delayed). */
  apiKey?: string;
  /** Override the API origin. Default: https://api.rektradar.io */
  baseUrl?: string;
  /** Custom fetch (Node <18 or non-standard runtimes). Defaults to global fetch. */
  fetch?: FetchLike;
}

/** Risk verdict for a single token. Extra upstream fields pass through. */
export interface TokenVerdict {
  address: string;
  score: number;
  flags: string[];
  [key: string]: unknown;
}

/** On-chain trading signals for a token, from swap/mint/burn events. */
export interface SwapEnrichment {
  /** Distinct swap senders. */
  traders: number;
  buys: number;
  sells: number;
  /** Buy volume on the WETH side of the pair. */
  buyVolWeth: number;
  /** Sell volume on the WETH side of the pair. */
  sellVolWeth: number;
  /** Net liquidity in WETH (mint - burn); negative means liquidity was drained. */
  netLiquidityWeth: number;
  /** Quote token the volumes are denominated in (currently always `"WETH"`). */
  quote: string;
}

/** Deep token view: verdict + liquidity + holders + on-chain swap signals. */
export interface TokenFull {
  score: unknown;
  liquidity: unknown;
  holders: unknown;
  /** On-chain swap signals. `null` for base/quote tokens (WETH, USDC, ...). */
  swaps?: SwapEnrichment | null;
}

export interface RugsResponse {
  summary: Record<string, unknown> | null;
  rugs: Array<Record<string, unknown>>;
  /** 0 for a paid (real-time) key, ~600 for a free (delayed) key. */
  dataDelaySeconds: number;
}

export interface RecentResponse {
  items: Array<Record<string, unknown>>;
  dataDelaySeconds: number;
}

export type TrendGranularity = "hourly" | "daily" | "weekly";

export interface TrendsOptions {
  /** Window: `6h`, `24h`, `7d`, `30d`. Defaults to `7d` server-side. */
  period?: string;
  /** Bucket size. Defaults from period (`6h`->hourly, `30d`->weekly, else daily). */
  granularity?: TrendGranularity;
}

/** One time bucket of the trends series. Extra upstream fields pass through. */
export interface TrendBucket {
  /** Bucket key: `YYYY-MM-DD` (daily/weekly) or `YYYY-MM-DD HH:00` (hourly). */
  date: string;
  /** New scam pools detected in the bucket. */
  tokensDetected: number;
  tokensAnalyzed: number;
  avgRiskScore: number;
  /** Analyses scoring >= 80 (honeypots). */
  honeypotCount: number;
  [key: string]: unknown;
}

export interface TrendsResponse {
  trends: TrendBucket[];
  granularity: TrendGranularity;
  period: string;
  /** 0 for daily/weekly + paid hourly; ~600 for free hourly (live hour withheld). */
  dataDelaySeconds: number;
}

/** Platform-wide aggregate counters. Real-time for every tier. Extra upstream fields pass through. */
export interface StatsResponse {
  /** Tokens analysed to completion. */
  tokensScanned: number;
  /** Analyses scoring >= 70. */
  scamsDetected: number;
  poolsMonitored: number;
  mempoolTxs: number;
  deployersMapped: number;
  scamDeployers: number;
  networkEdges: number;
  /** Analyses completed in the last 24h. */
  analyzed24h: number;
  /** ISO timestamp the snapshot was computed. */
  ts: string;
  [key: string]: unknown;
}
