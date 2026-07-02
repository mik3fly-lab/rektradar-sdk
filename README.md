# RektRadar SDK — Ethereum scam & rug-pull detection API

[![npm version](https://img.shields.io/npm/v/@mik3fly-lab/rektradar-sdk.svg)](https://www.npmjs.com/package/@mik3fly-lab/rektradar-sdk)
[![types: included](https://img.shields.io/npm/types/@mik3fly-lab/rektradar-sdk.svg)](https://www.npmjs.com/package/@mik3fly-lab/rektradar-sdk)
[![license: MIT](https://img.shields.io/npm/l/@mik3fly-lab/rektradar-sdk.svg)](./LICENSE)

Score any Ethereum token for **rug pulls, honeypots and scams** in one call — and get
pushed an **`imminent_rug`** event the moment a rug is sitting in the mempool, *before
it mines*. The official TypeScript SDK for the [RektRadar](https://rektradar.io) API.

```bash
npm install @mik3fly-lab/rektradar-sdk
```

```ts
import { RektRadar } from "@mik3fly-lab/rektradar-sdk";

const rr = new RektRadar(); // no key needed to start

const { score, flags } = await rr.token("0xTOKEN");
if (score >= 70) blockTrade(flags); // 0-100 risk, real-time, for everyone
```

That's the whole thing. It works **anonymously on the free tier**; a key unlocks the
real-time activity flows. **[Get an API key →](https://app.rektradar.io/account#api-keys)**

## Why RektRadar, not a honeypot checker

A plain "is this a honeypot" simulation is commoditized and free everywhere. RektRadar
exposes the **proprietary intel a sandbox can't see**:

- **`imminent_rug`** — the rug detected *in the mempool*, seconds before it lands on
  chain. The one signal that actually saves a trade.
- **Deployer graph & funding clusters** — who deployed the token, who funded them, and
  which other scams they are tied to (on-chain graph + shared bytecode).
- **Rug forensics** — liquidity pulls, holder distribution, drainer-kit bytecode
  matches: 100+ flags across 7 analyzers, the same engine that powers
  [rektradar.io](https://rektradar.io).

## Who it's for

| You build | You call |
|---|---|
| a **trading bot** | gate every buy on `rr.token(addr).score` |
| a **wallet / dapp** | warn on `rr.tokenFull(addr)` before a swap |
| a **Telegram / Discord bot** | stream `imminent_rug` + `rug` to a channel |
| a **launchpad / scanner** | subscribe to a `token.high_risk` webhook |

## The model: delay is the paywall

- **Targeted lookups** (`token`, `tokenFull`) are **real-time for everyone**.
- The **recent-activity flow** (`rugs`, `recent`) is **delayed ~10 min on a free key**
  and **real-time on a paid key**. Each flow response carries `dataDelaySeconds`
  (0 = real-time, 600 = delayed).

```ts
const { rugs, dataDelaySeconds } = await rr.rugs({ since: "7d" });
console.log(`fresh as of ${dataDelaySeconds}s ago`, rugs.length);
```

Real-time API access is included from the **Basic** plan up — see
[pricing & quotas](https://developers.rektradar.io).

## REST methods

| Method | Returns | Freshness |
|---|---|---|
| `rr.token(address)` | risk score + flags | real-time |
| `rr.tokenFull(address)` | verdict + liquidity + holders + swap signals (`swaps`) | real-time |
| `rr.rugs({ since })` | recent rug pulls | delayed (free) / live (paid) |
| `rr.recent()` | recent analyses feed | delayed (free) / live (paid) |
| `rr.topDeployers(limit)` | top scam deployers | real-time |
| `rr.trends({ period, granularity })` | scam pools / analyses over time | daily/weekly live; hourly delayed (free) / live (paid) |
| `rr.stats()` | platform-wide counters (tokens scanned, scams, deployers) | real-time |

```ts
// new scam pools per day over the last week
const { trends } = await rr.trends({ period: "7d", granularity: "daily" });
// the live hourly pulse (current hour withheld on the free tier)
const pulse = await rr.trends({ period: "6h", granularity: "hourly" });
```

Errors throw a `RektRadarError` with a numeric `.status`.

## Live stream

```ts
import { connectStream } from "@mik3fly-lab/rektradar-sdk";
import WebSocket from "ws"; // Node only; browsers use the global WebSocket

const handle = connectStream({
  apiKey: process.env.REKTRADAR_KEY,
  events: ["new_token", "imminent_rug", "rug"],
  WebSocket,
  onMessage: (e) => console.log(e.type, e.data),
});
// handle.close();
```

Stream events: `connected` (ack on open), `new_token`, `token_scored`, `score_update`,
**`imminent_rug`** (a pending rug seen in the mempool, before it mines), and `rug`
(liquidity pulled). Full schema (AsyncAPI 3.0):
<https://api.rektradar.io/v1/stream-docs>.

## Webhooks

RektRadar signs deliveries with `X-RektRadar-Signature: sha256=<hmac>`. Verify with the
raw request body (server-side):

```ts
import { verifyWebhook } from "@mik3fly-lab/rektradar-sdk";

const ok = verifyWebhook(rawBody, req.header("X-RektRadar-Signature") ?? "", SECRET);
if (!ok) return res.sendStatus(401);
```

## Configuration

```ts
new RektRadar({
  apiKey: "rr_live_...",               // optional (anonymous = free, delayed)
  baseUrl: "https://api.rektradar.io", // optional override
  fetch: customFetch,                  // optional (Node <18 / custom runtimes)
});
```

## Links

- **API docs & quotas** — <https://developers.rektradar.io>
- **Get an API key** — <https://app.rektradar.io/account#api-keys>
- **Web app** (free token scanner) — <https://rektradar.io>
- **Source** — <https://github.com/mik3fly-lab/rektradar-sdk>

## License

MIT
