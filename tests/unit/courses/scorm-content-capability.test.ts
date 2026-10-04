import { describe, expect, it } from "vitest";
import {
  parseScormContentSigningKeys,
  ScormContentSigningKeysError,
} from "@atlas/core/config/scorm-content-keys";
import {
  mintScormContentCapability,
  SCORM_CAPABILITY_TTL_SECONDS,
  verifyScormContentCapability,
} from "../../../backend/apps/api/src/server/courses/scorm-content-capability";

const KEY_A = "a1:0f9d8c7b6a5948372615a4b3c2d1e0f9e8d7c6b5a4938271";
const KEY_B = "b2:9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6c5b4a39281";
const env = (keys: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: "test",
  APP_ENV: "test",
  SCORM_CONTENT_SIGNING_KEYS: keys,
  ...extra,
});
const scope = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  membershipId: "018f0000-0000-7000-8000-000000000020",
  moduleId: "018f0000-0000-7000-8000-000000000030",
  contentVersion: "3b0f6a4e-9b3c-4f1e-8a7d-2c5e6f708192",
  scormVersion: "2004" as const,
};
const now = Date.parse("2026-10-03T10:00:00Z");

function mint(keys = KEY_A, nowMs = now) {
  return mintScormContentCapability(scope, { env: env(keys), nowMs });
}

describe("SCORM package-read capability", () => {
  it("round-trips its scope, launch id and expiry", () => {
    const { token, launchId, expiresAt } = mint();
    expect(expiresAt).toBe(now / 1000 + SCORM_CAPABILITY_TTL_SECONDS);
    expect(verifyScormContentCapability(token, { env: env(KEY_A), nowMs: now })).toEqual({
      ...scope,
      launchId,
      expiresAt,
    });
  });

  it("is a single path segment, so package-relative URLs resolve beneath it", () => {
    const { token } = mint();
    expect(token).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(token).not.toContain("/");
  });

  it("issues a fresh launch id per launch", () => {
    expect(mint().launchId).not.toBe(mint().launchId);
  });

  it("rejects a token with any part altered", () => {
    const { token } = mint();
    const [kid, payload, signature] = token.split(".") as [string, string, string];
    const forgedPayload = Buffer.from(
      JSON.stringify({
        ...(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as object),
        mbr: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toString("base64url");
    const flipped = `${signature.slice(0, -2)}${signature.endsWith("AA") ? "BB" : "AA"}`;
    for (const tampered of [
      `${kid}.${forgedPayload}.${signature}`,
      `${kid}.${payload}.${flipped}`,
      `b2.${payload}.${signature}`,
      `${kid}.${payload}`,
      "",
      `${token}.extra`,
      "x".repeat(2_000),
    ]) {
      expect(verifyScormContentCapability(tampered, { env: env(KEY_A), nowMs: now })).toBeNull();
    }
  });

  it("expires after its lifetime, allowing a minute of clock skew", () => {
    const { token } = mint();
    const lifetimeMs = SCORM_CAPABILITY_TTL_SECONDS * 1000;
    expect(
      verifyScormContentCapability(token, { env: env(KEY_A), nowMs: now + lifetimeMs + 59_000 }),
    ).not.toBeNull();
    expect(
      verifyScormContentCapability(token, { env: env(KEY_A), nowMs: now + lifetimeMs + 60_000 }),
    ).toBeNull();
  });

  it("rotates: new tokens use the first key, and old ones verify until their key is dropped", () => {
    const old = mint(KEY_A).token;
    const rotated = `${KEY_B},${KEY_A}`;
    const fresh = mint(rotated).token;
    expect(fresh.startsWith("b2.")).toBe(true);
    expect(verifyScormContentCapability(old, { env: env(rotated), nowMs: now })).not.toBeNull();
    expect(verifyScormContentCapability(fresh, { env: env(rotated), nowMs: now })).not.toBeNull();
    expect(verifyScormContentCapability(old, { env: env(KEY_B), nowMs: now })).toBeNull();
  });

  it("never verifies a token signed with another environment's key", () => {
    const { token } = mint(KEY_A);
    expect(
      verifyScormContentCapability(token, {
        env: env("a1:ffffffffffffffffffffffffffffffff0000000000000000"),
        nowMs: now,
      }),
    ).toBeNull();
  });

  it("fails closed in a deployed runtime without keys", () => {
    const deployed = {
      NODE_ENV: "production",
      APP_ENV: "production",
      SCORM_CONTENT_SIGNING_KEYS: "",
    };
    expect(() => mintScormContentCapability(scope, { env: deployed })).toThrow(
      /SCORM_CONTENT_SIGNING_KEYS is required/,
    );
  });

  it("uses one stable per-process key in local development", () => {
    const local = { NODE_ENV: "development", APP_ENV: "development" };
    const { token } = mintScormContentCapability(scope, { env: local, nowMs: now });
    expect(verifyScormContentCapability(token, { env: local, nowMs: now })).not.toBeNull();
  });
});

describe("SCORM_CONTENT_SIGNING_KEYS", () => {
  it.each([
    ["", /lists no keys/],
    ["nokid", /<kid>:<secret>/],
    ["k:short", /at least 32/],
    [`k:${"a".repeat(40)}`, /nontrivial/],
    [`${KEY_A},a1:${"b".repeat(10)}c${"d".repeat(30)}`, /kids must be unique/],
    [
      [1, 2, 3, 4, 5].map((n) => `k${String(n)}:${String(n).repeat(8)}${KEY_A.slice(3)}`).join(","),
      /more than 4/,
    ],
  ])("rejects %j", (raw, message) => {
    expect(() => parseScormContentSigningKeys(raw)).toThrow(ScormContentSigningKeysError);
    expect(() => parseScormContentSigningKeys(raw)).toThrow(message);
  });

  it("never echoes key material in errors", () => {
    const secret = "short-secret-value";
    try {
      parseScormContentSigningKeys(`k:${secret}`);
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
