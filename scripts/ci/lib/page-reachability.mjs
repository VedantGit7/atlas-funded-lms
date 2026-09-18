import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Page reachability: can a user actually navigate to each `page.tsx`?
 *
 * The API closure gate asks whether frontend source *calls* a route. It never
 * asks whether a page can be *reached*. Five screens once passed every gate in
 * this repo while being unreachable — created, functional, and linked from
 * nowhere — and two of those had been stranded long before anyone noticed,
 * because `/admin/manage` renders no section navigation at all.
 *
 * Split out of the check script so the matching can be unit-tested. Both bugs
 * this logic has already had were in the matching, not the crawling.
 */

const PRUNE = new Set([".next", "node_modules", "dist", ".turbo", ".git", "coverage"]);

export function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (PRUNE.has(entry)) continue;
    const path = join(dir, entry);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      // Stale build output can leave dangling directory entries behind.
      continue;
    }
    if (stats.isDirectory()) walkFiles(path, out);
    else out.push(path);
  }
  return out;
}

/** `app/(group)/a/[id]/page.tsx` -> `/a/[id]`; route groups are not URL segments. */
export function pageFileToRoute(appDir, file) {
  const relativePath = relative(appDir, file)
    .replace(/\\/g, "/")
    // The separator is optional: the root page is a bare `page.tsx`, and a
    // leading-slash pattern would leave it as the route "/page.tsx".
    .replace(/(^|\/)page\.tsx$/, "");

  const segments = relativePath
    .split("/")
    .filter((segment) => segment.length > 0 && !(segment.startsWith("(") && segment.endsWith(")")));

  return `/${segments.join("/")}`;
}

/** `[id]` -> `*`, so a route can be compared against a link. */
export function routeToPattern(route) {
  return route
    .split("/")
    .map((segment) => (segment.startsWith("[") && segment.endsWith("]") ? "*" : segment))
    .join("/");
}

const STOP_CHARS = new Set(["`", '"', "'", "?", "#", ",", ")", ";", "\\", " ", "\n", "\r", "\t"]);

/** Read a path forward from `start`, collapsing balanced `${...}` to `*`. */
export function readPathAt(text, start) {
  let out = "";
  let index = start;

  while (index < text.length) {
    const char = text[index];

    if (char === "$" && text[index + 1] === "{") {
      let depth = 1;
      let cursor = index + 2;
      while (cursor < text.length && depth > 0) {
        if (text[cursor] === "{") depth += 1;
        else if (text[cursor] === "}") depth -= 1;
        cursor += 1;
      }
      out += "*";
      index = cursor;
      continue;
    }

    if (STOP_CHARS.has(char)) break;
    out += char;
    index += 1;
  }

  return out;
}

/**
 * Match a ROUTE against a LINK. The direction matters and is not symmetric.
 *
 * A route wildcard came from `[id]` and accepts any link value. A LINK wildcard
 * came from `${slug}` and may only satisfy a *dynamic* route segment:
 * `/admin/${slug}` addresses `/admin/[slug]`, never the static `/admin/settings`.
 *
 * Treating the two as interchangeable is what made the first version of this
 * scan useless — one `/admin/${x}` link vouched for every two-segment admin
 * page, and it reported zero orphans with two deliberately unlinked pages
 * planted in the tree.
 */
export function segmentsMatch(routeSegments, linkSegments) {
  if (routeSegments.length !== linkSegments.length) return false;
  return routeSegments.every((routeSegment, index) => {
    const linkSegment = linkSegments[index];
    if (routeSegment === "*") return true;
    if (linkSegment === "*") return false;
    return routeSegment === linkSegment;
  });
}

/**
 * Collect navigable targets from source text.
 *
 * Two forms, because both appear in this repo and missing either produces false
 * orphans:
 *   - absolute: `"/admin/members"` or `` `/courses/${id}` ``
 *   - suffix:   `` `${adminInsightHref(slug)}/whatsapp` `` — the path begins
 *     with an interpolation, so there is no leading slash to anchor on. Seven
 *     insights pages were reported unreachable purely because of this.
 */
export function collectLinkTargets(sources) {
  const absolute = new Set();
  const suffixes = new Set();

  for (const source of sources) {
    for (const match of source.matchAll(/["'`]\/(?![/*])/g)) {
      const path = readPathAt(source, match.index + match[0].length - 1);
      if (path.length > 1 && !path.startsWith("/api/")) absolute.add(path);
    }

    for (const match of source.matchAll(/`\$\{/g)) {
      const path = readPathAt(source, match.index + 1);
      if (!path.startsWith("*/")) continue;
      const suffix = path.slice(1);
      if (suffix.length > 1 && !suffix.startsWith("/api/")) suffixes.add(suffix);
    }
  }

  return {
    absolute: new Set([...absolute].map(routeToPattern)),
    suffixes: [...suffixes].map(routeToPattern),
  };
}

/** True when some link target can navigate to this route. */
export function isRouteLinked(route, targets) {
  const routePattern = routeToPattern(route);
  if (targets.absolute.has(routePattern)) return true;

  const routeSegments = routePattern.split("/");

  for (const target of targets.absolute) {
    if (segmentsMatch(routeSegments, target.split("/"))) return true;
  }

  // `${base}/publish` reaches any route whose trailing segments match.
  for (const suffix of targets.suffixes) {
    const suffixSegments = suffix.split("/").filter(Boolean);
    if (suffixSegments.length === 0 || suffixSegments.length >= routeSegments.length) continue;
    const tail = routeSegments.slice(routeSegments.length - suffixSegments.length);
    if (segmentsMatch(tail, suffixSegments)) return true;
  }

  return false;
}
