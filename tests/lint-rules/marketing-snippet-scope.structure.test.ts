import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SIGNUP_COMPLETE_PARAM,
  SNIPPET_ALLOWED_ROOTS,
  SNIPPET_BLOCKED_ROOTS,
  snippetsAllowedOn,
  withSignupCompleteMarker,
} from "../../frontend/apps/web/src/features/marketing/snippet-scope";

/**
 * Tenant code snippets run on this origin with the viewer's authority (audit
 * H5). Whether a route may run them is a deliberate decision, so every
 * top-level route must be classified: a new staff, credential or account area
 * must not default to running tenant code.
 */
const appDir = resolve(import.meta.dirname, "../../frontend/apps/web/src/app");

/** Top-level URL segments, with route groups like `(learner)` flattened. */
function topLevelSegments(directory: string): string[] {
  const segments: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (!statSync(path).isDirectory() || entry.startsWith("_") || entry === "api") continue;
    if (/^\(.+\)$/.test(entry)) segments.push(...topLevelSegments(path));
    else segments.push(entry);
  }
  return segments;
}

describe("marketing snippet scope", () => {
  it("classifies every top-level route as allowed or blocked, never both", () => {
    const classified = new Set<string>([...SNIPPET_ALLOWED_ROOTS, ...SNIPPET_BLOCKED_ROOTS]);
    const unclassified = topLevelSegments(appDir).filter((segment) => !classified.has(segment));
    expect(unclassified).toEqual([]);
    const overlap = SNIPPET_ALLOWED_ROOTS.filter((root) =>
      (SNIPPET_BLOCKED_ROOTS as readonly string[]).includes(root),
    );
    expect(overlap).toEqual([]);
  });

  it("blocks staff, credential and account pages", () => {
    for (const path of [
      "/admin",
      "/admin/marketing/integrations",
      "/studio/courses/1",
      "/platform/tenants",
      "/moderate",
      "/review/queue",
      "/login",
      "/signup",
      "/reset-password",
      "/invite/accept",
      "/auth/callback",
      "/verify-email",
      "/profile/security",
      "/settings",
    ])
      expect(snippetsAllowedOn(path), path).toBe(false);
  });

  it("allows public and learner pages, and denies anything unknown", () => {
    for (const path of ["/", "/courses", "/courses/abc", "/p/landing", "/progress", "/terms"])
      expect(snippetsAllowedOn(path), path).toBe(true);
    expect(snippetsAllowedOn("/a-route-nobody-classified")).toBe(false);
  });

  it("marks post-signup destinations without disturbing their query or hash", () => {
    expect(withSignupCompleteMarker("/")).toBe(`/?${SIGNUP_COMPLETE_PARAM}=1`);
    expect(withSignupCompleteMarker("/courses?tab=mine#top")).toBe(
      `/courses?tab=mine&${SIGNUP_COMPLETE_PARAM}=1#top`,
    );
  });

  it("is mounted lazily by the root layout, and scopes itself", () => {
    const layout = readFileSync(join(appDir, "layout.tsx"), "utf8");
    expect(layout).toContain("LazyMarketingSnippets");
    expect(layout).not.toContain("<MarketingSnippetsInjector");
    const injector = readFileSync(
      resolve(appDir, "../features/marketing/MarketingSnippetsInjector.tsx"),
      "utf8",
    );
    expect(injector).toContain("snippetsAllowedOn");
    expect(injector).toContain("window.location.reload()");
  });
});
