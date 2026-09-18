import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "@atlas/api/assert-same-origin";

/**
 * Regression tests for audit finding H20 (cross-tenant CSRF).
 *
 * `SameSite=Lax` is evaluated against the registrable domain, so tenants on
 * subdomains of one base domain are same-site and Lax does not separate them.
 * A page on tenant-a.atlas.com could issue authenticated state-changing
 * requests to tenant-b.atlas.com.
 */

const HOST = "tenant-b.atlas.com";

describe("assertSameOrigin", () => {
  it.each(["GET", "HEAD", "OPTIONS"])("ignores safe method %s", (method) => {
    expect(() =>
      assertSameOrigin({ method, origin: "https://evil.atlas.com", host: HOST }),
    ).not.toThrow();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "rejects %s from a sibling tenant subdomain",
    (method) => {
      expect(() =>
        assertSameOrigin({ method, origin: "https://tenant-a.atlas.com", host: HOST }),
      ).toThrow("Invalid origin.");
    },
  );

  it("allows a same-host mutation", () => {
    expect(() =>
      assertSameOrigin({ method: "POST", origin: `https://${HOST}`, host: HOST }),
    ).not.toThrow();
  });

  it("compares host case-insensitively", () => {
    expect(() =>
      assertSameOrigin({ method: "POST", origin: "https://TENANT-B.ATLAS.COM", host: HOST }),
    ).not.toThrow();
  });

  // The port used to be compared, and could never match: `host` is the resolved
  // tenant host, which `normalizeHost` strips the port from. So every browser
  // mutation served on a non-default port was rejected — which is every request
  // in local development, where the console runs on :3000.
  it("allows a mutation from the same hostname on a development port", () => {
    expect(() =>
      assertSameOrigin({
        method: "POST",
        origin: "http://tenant-b.localhost.test:3000",
        host: "tenant-b.localhost.test",
      }),
    ).not.toThrow();
  });

  it("allows a mutation from the same hostname on any other port", () => {
    // Nothing is conceded by this: cookies are not scoped by port, so an origin
    // on the same hostname already receives the same cookies and is not a
    // principal this guard can separate. Tenants differ by hostname.
    expect(() =>
      assertSameOrigin({ method: "POST", origin: "https://tenant-b.atlas.com:8443", host: HOST }),
    ).not.toThrow();
  });

  it("still rejects a sibling tenant that shares a port", () => {
    // The property the guard exists for, unchanged.
    expect(() =>
      assertSameOrigin({
        method: "POST",
        origin: "http://tenant-a.atlas.com:3000",
        host: "tenant-b.atlas.com",
      }),
    ).toThrow("Invalid origin.");
  });

  it("tolerates a host that arrives carrying a port", () => {
    expect(() =>
      assertSameOrigin({
        method: "POST",
        origin: "http://tenant-b.atlas.com:3000",
        host: `${HOST}:3000`,
      }),
    ).not.toThrow();
  });

  it("rejects an opaque origin", () => {
    // A sandboxed iframe sends the literal "null"; that is a browser request
    // whose origin cannot be verified, not an absent Origin header.
    expect(() => assertSameOrigin({ method: "POST", origin: "null", host: HOST })).toThrow(
      "Invalid origin.",
    );
  });

  it("does not treat a hostname suffix as a match", () => {
    expect(() =>
      assertSameOrigin({ method: "POST", origin: "https://evil-atlas.com", host: "atlas.com" }),
    ).toThrow("Invalid origin.");
  });

  it("rejects a malformed origin outright", () => {
    expect(() => assertSameOrigin({ method: "POST", origin: "not a url", host: HOST })).toThrow(
      "Invalid origin.",
    );
  });

  // CSRF depends on a browser attaching cookies automatically, and browsers
  // always send Origin on non-GET. A missing Origin is a non-browser client,
  // so rejecting it would break the mobile app and scripts for no security gain.
  it("allows a mutation with no Origin header (non-browser client)", () => {
    expect(() => assertSameOrigin({ method: "POST", origin: null, host: HOST })).not.toThrow();
  });
});

describe("both route wrappers apply the guard (H20)", () => {
  // Phase 2.5 named createTenantRoute *and* createPlatformRoute. Only the tenant
  // wrapper got it, so the platform console — the one surface with cross-tenant
  // reach — was the single wrapper without CSRF protection, and nothing noticed
  // because the unit tests above exercise the helper rather than its callers.
  it.each([
    ["createTenantRoute", "backend/packages/api/src/create-tenant-route.ts"],
    ["createPlatformRoute", "backend/packages/api/src/create-platform-route.ts"],
  ])("%s calls assertSameOrigin", (_label, file) => {
    const source = readFileSync(resolve(import.meta.dirname, "../../..", file), "utf8");
    expect(source).toContain("assertSameOrigin({");
  });
});
