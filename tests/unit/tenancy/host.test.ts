import { describe, expect, it } from "vitest";
import { normalizeHost, resolveRequestHostFromHeaders } from "@atlas/tenancy";

describe("normalizeHost", () => {
  it("normalizes lowercase host without port", () => {
    expect(normalizeHost("Academy.Tenant-A.Com:443")).toBe("academy.tenant-a.com");
  });

  it("rejects missing host", () => {
    expect(() => normalizeHost(null)).toThrow("Tenant not found");
  });

  it("rejects unsafe host values", () => {
    expect(() => normalizeHost("example.com/path")).toThrow("Tenant not found");
  });

  it("does not silently default localhost to a tenant", () => {
    expect(() => normalizeHost("localhost:3000")).toThrow("Tenant not found");
  });
});

describe("resolveRequestHostFromHeaders", () => {
  it("uses x-forwarded-host for internal localhost requests", () => {
    const headers = new Headers({
      host: "127.0.0.1:3001",
      "x-forwarded-host": "acme-academy.localhost.test:3000",
    });

    expect(resolveRequestHostFromHeaders(headers)).toBe("acme-academy.localhost.test");
  });

  it("prefers the direct host for public tenant domains", () => {
    const headers = new Headers({
      host: "acme-academy.localhost.test:3000",
      "x-forwarded-host": "evil.example.com",
    });

    expect(resolveRequestHostFromHeaders(headers)).toBe("acme-academy.localhost.test");
  });

  it("prefers x-atlas-tenant-host when stamped by the frontend proxy", () => {
    const headers = new Headers({
      host: "127.0.0.1:3001",
      "x-forwarded-host": "evil.example.com",
      "x-atlas-tenant-host": "acme-academy.localhost.test:3000",
    });

    expect(resolveRequestHostFromHeaders(headers)).toBe("acme-academy.localhost.test");
  });
});
