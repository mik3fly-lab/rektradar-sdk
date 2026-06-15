import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhook } from "./webhooks.js";

const secret = "whsec_test";
const body = JSON.stringify({ type: "rug.detected", token: "0xabc" });
const goodSig = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;

describe("verifyWebhook", () => {
  it("accepts a correct signature", () => {
    expect(verifyWebhook(body, goodSig, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifyWebhook(`${body} `, goodSig, secret)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(verifyWebhook(body, goodSig, "wrong-secret")).toBe(false);
  });

  it("rejects an empty signature or secret", () => {
    expect(verifyWebhook(body, "", secret)).toBe(false);
    expect(verifyWebhook(body, goodSig, "")).toBe(false);
  });
});
