import { describe, expect, it } from "vitest";
import {
  generateSessionProof,
  hashClientIp,
  hashUserAgent,
  isSessionProofExpired,
  parseDiagnosticSessionCookieValue,
  verifySessionSecret,
} from "@atlas/security";

describe("diagnostic session security helpers", () => {
  it("hashes ip and user agent without storing raw values", () => {
    const req = new Request("https://tenant-a.example.com/api/v1/public/diagnostic/start", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "user-agent": "AtlasTestAgent/1.0",
      },
    });

    const ipHash = hashClientIp(req);
    const userAgentHash = hashUserAgent(req);

    expect(ipHash).not.toContain("203.0.113.10");
    expect(userAgentHash).not.toContain("AtlasTestAgent");
    expect(ipHash).toHaveLength(64);
    expect(userAgentHash).toHaveLength(64);
  });

  it("verifies cookie session proof and expiration", () => {
    const proof = generateSessionProof(Date.now());
    expect(verifySessionSecret(proof.secret, proof.secretHash)).toBe(true);
    expect(verifySessionSecret("wrong-secret", proof.secretHash)).toBe(false);
    expect(isSessionProofExpired(proof.expiresAt, Date.now() + 60_000)).toBe(false);
    expect(isSessionProofExpired(proof.expiresAt, Date.now() + 25 * 60 * 60 * 1000)).toBe(true);
  });

  it("parses diagnostic session cookie values", () => {
    const anonymousId = "018f0000-0000-7000-8000-000000000001";
    const secret = "abc123";
    const parsed = parseDiagnosticSessionCookieValue(`${anonymousId}.${secret}`);
    expect(parsed).toEqual({ anonymousId, secret });
    expect(parseDiagnosticSessionCookieValue("invalid")).toBeNull();
  });
});
