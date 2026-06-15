import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a RektRadar webhook signature.
 *
 * RektRadar signs webhook deliveries with an HMAC-SHA256 of the raw request
 * body, sent as `X-RektRadar-Signature: sha256=<hex>`. Pass the RAW body string
 * (not the parsed JSON) so the bytes match what was signed.
 *
 * Server-side only: uses node:crypto and a constant-time comparison.
 *
 * @example
 * app.post("/webhooks/rektradar", express.text({ type: "*\/*" }), (req, res) => {
 *   const ok = verifyWebhook(req.body, req.header("X-RektRadar-Signature") ?? "", SECRET);
 *   if (!ok) return res.sendStatus(401);
 *   const event = JSON.parse(req.body);
 *   // ...
 * });
 */
export function verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
  const provided = Buffer.from(signature);
  const computed = Buffer.from(expected);
  if (provided.length !== computed.length) {
    return false;
  }
  return timingSafeEqual(provided, computed);
}
