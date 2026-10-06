import { describe, expect, it } from "vitest";
import {
  assertRedirectOnRequestHost,
  assertRedirectOnRequestHostFrom,
} from "@atlas/api/redirect-target";

/**
 * Auth emails and OAuth sign-in carry a caller-chosen return URL that Supabase
 * puts in the link it sends. It must point at the host the request came from,
 * never at another tenant or an outside site.
 */

const HOST = "tenant-a.example.com";
const check = (value: string, requestHost = HOST) =>
  assertRedirectOnRequestHost({ value, requestHost, field: "emailRedirectTo" });

describe("assertRedirectOnRequestHost", () => {
  it("accepts a page on the request's own host", () => {
    expect(check("https://tenant-a.example.com/auth/confirm")).toBe(
      "https://tenant-a.example.com/auth/confirm",
    );
  });

  it("compares hosts case-insensitively, and ignores the request host's port", () => {
    expect(check("https://TENANT-A.example.com/auth/confirm", "Tenant-A.Example.com:443")).toBe(
      "https://tenant-a.example.com/auth/confirm",
    );
  });

  it.each([
    ["another tenant", "https://tenant-b.example.com/auth/confirm"],
    ["an outside site", "https://evil.example/auth/confirm"],
    ["a subdomain of the tenant", "https://evil.tenant-a.example.com/auth/confirm"],
    ["a look-alike suffix", "https://tenant-a.example.com.evil.example/auth/confirm"],
    ["plain http on a public domain", "http://tenant-a.example.com/auth/confirm"],
    ["an explicit port on a public domain", "https://tenant-a.example.com:8443/auth/confirm"],
    ["embedded credentials", "https://user:pass@tenant-a.example.com/auth/confirm"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<script>alert(1)</script>"],
    ["something that is not a URL", "/auth/confirm"],
  ])("refuses %s", (_label, value) => {
    expect(() => check(value)).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR", status: 400 }),
    );
  });

  it("allows http and a port on development hostnames only", () => {
    expect(check("http://academy.localhost.test:3000/auth/confirm", "academy.localhost.test")).toBe(
      "http://academy.localhost.test:3000/auth/confirm",
    );
  });

  it("refuses when the request host cannot be resolved", () => {
    expect(() => check("https://tenant-a.example.com/x", "")).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });
});

describe("assertRedirectOnRequestHostFrom (public routes)", () => {
  it("uses the browser host the web proxy forwarded", () => {
    // What the API sees after its proxy kept an authenticated forwarded host.
    const headers = new Headers({
      host: "api.internal.example",
      "x-atlas-tenant-host": "tenant-a.example.com",
    });
    expect(
      assertRedirectOnRequestHostFrom(
        headers,
        "https://tenant-a.example.com/auth/callback",
        "redirectTo",
      ),
    ).toBe("https://tenant-a.example.com/auth/callback");
  });

  it("falls back to the request's own host, and so refuses a tenant URL sent straight to the API", () => {
    // An unauthenticated caller's forwarded host is stripped before handlers run.
    const headers = new Headers({ host: "api.internal.example" });
    expect(() =>
      assertRedirectOnRequestHostFrom(
        headers,
        "https://tenant-a.example.com/auth/callback",
        "redirectTo",
      ),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });
});
