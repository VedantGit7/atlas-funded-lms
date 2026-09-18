import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs CI helper, no type declarations by design.
import {
  collectLinkTargets,
  isRouteLinked,
  pageFileToRoute,
  readPathAt,
  segmentsMatch,
  walkFiles,
} from "../../scripts/ci/lib/page-reachability.mjs";

/**
 * Every page must be reachable from somewhere in the app.
 *
 * The API closure gate asks whether a route is *called*. Nothing asked whether
 * a page could be *reached*, and five screens once shipped through every green
 * gate while being navigable from nowhere. Two of them had been stranded long
 * before that: `/admin/manage` renders no section navigation, so most Manage
 * sections were reachable only by typing the URL.
 *
 * "Referenced" and "reachable" are different properties. This asserts the
 * second one.
 */

const repoRoot = resolve(import.meta.dirname, "..", "..");
const webSrc = join(repoRoot, "frontend/apps/web/src");
const appDir = join(webSrc, "app");

type EntryPoint = { path: string; reason: string };

function loadDirectEntryPoints(): string[] {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "configs/ci/page-reachability.json"), "utf8"),
  ) as { directEntryPoints?: unknown };

  const entries = (manifest.directEntryPoints ?? []) as EntryPoint[];
  for (const entry of entries) {
    // A bare string would let someone silence this gate without saying why.
    if (typeof entry !== "object" || !entry.path || !entry.reason) {
      throw new Error(`directEntryPoints entry must be { path, reason }: ${JSON.stringify(entry)}`);
    }
  }
  return entries.map((entry) => entry.path);
}

/** Source that can navigate a user. API route handlers cannot. */
function navigableSources(): string[] {
  const files = [
    ...walkFiles(webSrc),
    // The backend issues redirect targets too: /invite/security is returned by
    // public-auth-ui.service after an invite is accepted, and is reachable only
    // through that. Scanning frontend source alone reports it as an orphan.
    ...walkFiles(join(repoRoot, "backend/packages")),
    ...walkFiles(join(repoRoot, "backend/apps")),
  ] as string[];

  return files
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .filter((file) => !/[/\\]app[/\\]api[/\\]/.test(file.replace(/\\/g, "/")))
    .map((file) => {
      try {
        return readFileSync(file, "utf8");
      } catch {
        return "";
      }
    });
}

describe("page reachability", () => {
  it("leaves no page unreachable", () => {
    const pageFiles = (walkFiles(appDir) as string[]).filter((file) =>
      /[/\\]page\.tsx$/.test(file),
    );
    const routes = [
      ...new Set(pageFiles.map((file) => pageFileToRoute(appDir, file) as string)),
    ].sort();

    const targets = collectLinkTargets(navigableSources());
    const allowed = new Set(loadDirectEntryPoints());

    // Vacuity guards. Without these a crawler that silently stops finding files,
    // or a matcher that stops producing targets, passes by checking nothing.
    expect(routes.length, "pages discovered").toBeGreaterThan(250);
    expect(
      (targets.absolute as Set<string>).size,
      "navigable link targets discovered",
    ).toBeGreaterThan(300);

    const unreachable = routes.filter(
      (route) => !allowed.has(route) && !isRouteLinked(route, targets),
    );

    expect(
      unreachable,
      `these pages exist but nothing links to them. Either link them, or add them to ` +
        `configs/ci/page-reachability.json with a reason:\n${unreachable.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * The matcher's own regression tests. Both live bugs this gate has had were
   * here rather than in the crawling, and the second one made it report zero
   * orphans with two deliberately unlinked pages planted.
   */
  describe("route/link matching", () => {
    it("lets a dynamic route accept any link value", () => {
      expect(segmentsMatch(["", "courses", "*"], ["", "courses", "abc"])).toBe(true);
    });

    it("does not let a dynamic LINK vouch for a static route", () => {
      // `/admin/${slug}` addresses /admin/[slug], never /admin/settings.
      expect(segmentsMatch(["", "admin", "settings"], ["", "admin", "*"])).toBe(false);
    });

    it("reads a path across a nested interpolation", () => {
      // Index 4 is the leading slash: g(0) o(1) ((2) backtick(3) /(4).
      expect(readPathAt("go(`/a/${f({ x: 1 })}/b`)", 4)).toBe("/a/*/b");
    });

    it("finds a path that begins with an interpolation", () => {
      const targets = collectLinkTargets(["`${insightHref(slug)}/whatsapp`"]);
      expect(isRouteLinked("/admin/insights/[slug]/whatsapp", targets)).toBe(true);
    });

    it("still reports a page nothing links to", () => {
      // The control. Without it, every assertion above could pass on a matcher
      // that simply says yes to everything.
      const targets = collectLinkTargets(['"/admin/members"', "`/admin/${slug}`"]);
      expect(isRouteLinked("/admin/members", targets)).toBe(true);
      expect(isRouteLinked("/admin/[slug]", targets)).toBe(true);
      expect(isRouteLinked("/admin/zzz-nothing-links-here", targets)).toBe(false);
    });
  });
});
