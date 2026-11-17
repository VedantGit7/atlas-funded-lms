import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every rendered page must pass through the web proxy, which stamps the
 * client IP the API's rate limits need. favicon.ico and sitemap.xml were
 * skipped, so their not-found pages loaded the academy's branding without an
 * IP and the API refused it with 503 (Sentry ATLAS-LMS-6).
 */
describe("web proxy matcher", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../../frontend/apps/web/src/proxy.ts"),
    "utf8",
  );
  const pattern = /matcher:\s*\[[\s\S]*?"(\/\(\(\?![^"]+)"/.exec(source)?.[1];
  const matches = (path: string) => new RegExp(`^${pattern ?? "$^"}$`).test(path);

  it("has a matcher to check", () => {
    expect(pattern).toBeDefined();
  });

  it.each(["/favicon.ico", "/sitemap.xml", "/robots.txt", "/login", "/admin"])(
    "runs the proxy for %s",
    (path) => {
      expect(matches(path)).toBe(true);
    },
  );

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/fonts/inter/v20/inter.woff2",
    "/fonts/manrope/v1/normal-latin.e310b55a7fd9.woff2",
    "/fonts/ibm-plex-mono/v1/normal-400-latin.c36f509c0a8f.woff2",
  ])("keeps static assets out: %s", (path) => {
    expect(matches(path)).toBe(false);
  });
});
