# @mik3fly-lab/rektradar-sdk

Official SDK for the [RektRadar](https://rektradar.io) API - Ethereum scam and
rug-pull detection. Get a token's risk score and flags, stream new high-risk
deploys and rugs in real time, and verify webhook deliveries.

```bash
npm install @mik3fly-lab/rektradar-sdk
```

## Quickstart

```ts
import { RektRadar } from "@mik3fly-lab/rektradar-sdk";

const rr = new RektRadar({ apiKey: process.env.REKTRADAR_KEY });

// Real-time verdict for any token (works on the free tier too)
const verdict = await rr.token("0x...");
if (verdict.score >= 70) {
  console.warn("high risk", verdict.flags);
}
```

No key? It still works - anonymously, on the free tier (the activity flow is
delayed, see below).

## Freshness model ("delay is the paywall")

- **Targeted lookups** (`token`, `tokenFull`) are **real-time for everyone**.
- The **recent-activity flow** (`rugs`, `recent`) is **delayed ~10 min on a
  free key** and **real-time on a paid key**. Each flow response carries
  `dataDelaySeconds` (0 = real-time, 600 = delayed).

```ts
const { rugs, dataDelaySeconds } = await rr.rugs({ since: "7d" });
console.log(`fresh as of ${dataDelaySeconds}s ago`, rugs.length);
```

## REST methods

| Method | Returns | Freshness |
|---|---|---|
| `rr.token(address)` | risk score + flags | real-time |
| `rr.tokenFull(address)` | verdict + liquidity + holders | real-time |
| `rr.rugs({ since })` | recent rug pulls | delayed (free) / live (paid) |
| `rr.recent()` | recent analyses feed | delayed (free) / live (paid) |
| `rr.topDeployers(limit)` | top scam deployers | real-time |

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

Stream events: `connected` (ack on open), `new_token`, `token_scored`,
`score_update`, **`imminent_rug`** (a pending rug seen in the mempool, before it
mines), and `rug` (liquidity pulled). Full schema (AsyncAPI 3.0):
<https://api.rektradar.io/v1/stream-docs>.

## Webhooks

RektRadar signs deliveries with `X-RektRadar-Signature: sha256=<hmac>`. Verify
with the raw request body (server-side):

```ts
import { verifyWebhook } from "@mik3fly-lab/rektradar-sdk";

const ok = verifyWebhook(rawBody, req.header("X-RektRadar-Signature") ?? "", SECRET);
if (!ok) return res.sendStatus(401);
```

## Configuration

```ts
new RektRadar({
  apiKey: "rr_live_...",          // optional (anonymous = free, delayed)
  baseUrl: "https://api.rektradar.io", // optional override
  fetch: customFetch,             // optional (Node <18 / custom runtimes)
});
```

## License

MIT
