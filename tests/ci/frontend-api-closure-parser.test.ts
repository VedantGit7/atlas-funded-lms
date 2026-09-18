import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs CI helper, no type declarations by design.
import {
  extractFrontendApiPatterns,
  patternMatchesRoute,
  readApiPathAt,
  routePathToPattern,
} from "../../scripts/ci/lib/api-path-patterns.mjs";

/**
 * The frontend API closure gate failed on its own parser for seventeen
 * `/api/v1/reports/*` routes that were fully wired. That is a worse failure than
 * having no gate: a red gate invites an allowlist entry, and an allowlist entry
 * would have permanently excused a route that was fine.
 *
 * These cases are the exact shapes that broke it.
 */
function patternsFor(source: string): Set<string> {
  return extractFrontendApiPatterns(source) as Set<string>;
}

function wired(source: string, routePath: string): boolean {
  return patternMatchesRoute(routePathToPattern(routePath), patternsFor(source)) as boolean;
}

describe("frontend API closure parser", () => {
  it("reads an interpolation containing nested braces", () => {
    // `[^}]+` stopped at the object literal's `}`, leaving `learners*)}`.
    const source =
      "clientApi.get(`/api/v1/reports/batches/${batchId}/content/learners${buildQuery({ q, page: 1 })}`)";

    expect(wired(source, "/api/v1/reports/batches/[batchId]/content/learners")).toBe(true);
  });

  it("finds a path that does not start the template", () => {
    // Absolute URLs built as `${origin}/api/v1/...` were invisible.
    const source = "const url = `${origin}/api/v1/public/credentials/${id}/open-badge`;";

    expect(wired(source, "/api/v1/public/credentials/[credentialId]/open-badge")).toBe(true);
  });

  it("is not thrown off by an unrelated backtick earlier in the source", () => {
    // Pairing backticks let one stray tick shift every later pairing. This
    // regressed /api/v1/diagnostic/${id}/result when the matcher was widened.
    const source = [
      "// see `docs/notes.md`",
      "post(`/api/v1/diagnostic/${sessionId}/result`)",
    ].join("\n");

    expect(wired(source, "/api/v1/diagnostic/[id]/result")).toBe(true);
  });

  it("still reports a route with no caller", () => {
    // The point of the gate. Without this the fixes above could pass by
    // matching everything.
    const source = "clientApi.get(`/api/v1/batches/${batchId}/members`)";

    expect(wired(source, "/api/v1/batches/[id]/members")).toBe(true);
    expect(wired(source, "/api/v1/batches/[id]")).toBe(false);
    expect(wired(source, "/api/v1/polls/[id]/respond")).toBe(false);
  });

  it("keeps the literal when an interpolation is only a query suffix", () => {
    // `/api/v1/exports${query ? `?${query}` : ""}` collapsed to the pattern `*`,
    // which then matched every single-segment route. Three real routes with no
    // caller at all were reported as wired on the strength of this one line.
    const source = 'get(`/api/v1/exports${query ? `?${query}` : ""}`)';

    expect(wired(source, "/api/v1/exports")).toBe(true);
    expect(wired(source, "/api/v1/bundles")).toBe(false);
    expect(wired(source, "/api/v1/mock-tests")).toBe(false);
  });

  it("never admits an all-wildcard pattern", () => {
    // A pattern of nothing but wildcards is evidence about no route in
    // particular, so admitting one silently disables the gate for that shape.
    const source = "get(`/api/v1/${resource}`)";

    expect(patternsFor(source).has("*")).toBe(false);
    expect(wired(source, "/api/v1/bundles")).toBe(false);
  });

  it("stops the path at a quote, query or punctuation", () => {
    expect(readApiPathAt('get("/api/v1/me")', 5)).toBe("/api/v1/me");
    expect(readApiPathAt("get(`/api/v1/me?expand=1`)", 5)).toBe("/api/v1/me");
  });

  it("treats a plain literal and an interpolated path the same way", () => {
    expect(patternsFor('get("/api/v1/courses/abc/modules")').has("courses/abc/modules")).toBe(true);
    expect(patternsFor("get(`/api/v1/courses/${id}/modules`)").has("courses/*/modules")).toBe(true);
  });
});
