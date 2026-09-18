/**
 * Pattern extraction for the frontend API closure check.
 *
 * Split out of `check-frontend-api-closure.mjs` so the parsing can be tested on
 * its own. It could not be before — the checker is a top-level script that
 * walks the repo and calls `process.exit`, so importing it ran the whole gate.
 * The parser had two bugs that a five-line unit test would have caught, and both
 * of them made the gate report working routes as broken.
 */

/** Convert a Next.js route path to a comparable pattern: `[id]` becomes `*`. */
export function routePathToPattern(apiPath) {
  return apiPath
    .replace(/^\/api\/v1\//, "")
    .split("/")
    .map((segment) => (segment.startsWith("[") && segment.endsWith("]") ? "*" : segment))
    .join("/");
}

/**
 * Normalise one segment's interpolations.
 *
 * The distinction matters more than it looks. Collapsing any segment that
 * contains a `*` into a bare `*` destroys the literal in
 * `` `/api/v1/exports${query ? `?${query}` : ""}` ``, yielding the pattern `*` —
 * which then matches EVERY single-segment route. `/api/v1/bundles`,
 * `/api/v1/mock-tests` and `/api/v1/tags` were all reported as wired on the
 * strength of that one call site, while having no caller at all. A gate that
 * over-matches is worse than a noisy one: it goes quiet instead of wrong.
 *
 * So a trailing interpolation is treated as the query/suffix it almost always
 * is, and the literal prefix survives. Only a segment that is entirely dynamic
 * — or dynamic at its start, where no prefix can be trusted — becomes `*`.
 */
function normalizeSegment(segment) {
  if (!segment.includes("*")) return segment;

  const withoutTrailing = segment.replace(/\*+$/, "");
  // A prefix survives only when every wildcard sat at the end.
  return withoutTrailing.length > 0 && !withoutTrailing.includes("*") ? withoutTrailing : "*";
}

export function collapseWildcardSegments(path) {
  const withoutQuery = path.split("?")[0] ?? path;
  return withoutQuery.split("/").map(normalizeSegment).join("/");
}

/**
 * True when every segment of a pattern is a wildcard.
 *
 * Such a pattern carries no evidence that any particular route is called — it
 * matches everything of that shape — so admitting one silently disables the
 * gate for every route with that segment count.
 */
export function isUninformativePattern(pattern) {
  return pattern.split("/").every((segment) => segment === "*");
}

/** Characters that end an API path in source: quoting, query, or punctuation. */
const PATH_TERMINATORS = new Set(["`", '"', "'", "?", ",", ")", ";", "\\"]);

/**
 * Read one API path forward from a `/api/v1/` occurrence.
 *
 * Two failures this replaces, both of which reported live routes as unwired:
 *
 * 1. `.replace(/\$\{[^}]+\}/g, "*")` could not see nested braces, so
 *    `` `/api/v1/reports/batches/${id}/content/learners${buildQuery({ q })}` ``
 *    normalised to `learners*)}` and matched nothing. Seventeen
 *    `/api/v1/reports/*` endpoints were reported unwired while their fetchers
 *    sat in `admin-*-api.ts`. Balanced-brace scanning is what fixes it.
 *
 * 2. Anchoring to a backtick missed `` `${origin}/api/v1/...` ``, and pairing
 *    backticks to find templates is quietly fragile: one stray backtick in the
 *    concatenated frontend source shifts every later pairing, silently dropping
 *    paths after it. Scanning forward from the marker treats literals and
 *    templates identically and never inspects quoting at all.
 *
 * Accuracy cuts both ways: the old parser also truncated `/api/v1/batches/${id}`
 * at the `$`, leaving the prefix `batches/`, which spuriously matched
 * `batches/*`. Reading the interpolation properly exposed two routes that
 * genuinely have no frontend caller.
 */
export function readApiPathAt(source, start) {
  let out = "";
  let index = start;

  while (index < source.length) {
    const char = source[index];

    if (char === "$" && source[index + 1] === "{") {
      let depth = 1;
      let cursor = index + 2;
      while (cursor < source.length && depth > 0) {
        if (source[cursor] === "{") depth += 1;
        else if (source[cursor] === "}") depth -= 1;
        cursor += 1;
      }
      out += "*";
      index = cursor;
      continue;
    }

    if (PATH_TERMINATORS.has(char) || /\s/.test(char)) break;
    out += char;
    index += 1;
  }

  return collapseWildcardSegments(out);
}

/** Every `/api/v1/...` path referenced anywhere in the given source text. */
export function extractFrontendApiPatterns(source) {
  const patterns = new Set();
  const marker = "/api/v1/";

  for (
    let index = source.indexOf(marker);
    index !== -1;
    index = source.indexOf(marker, index + 1)
  ) {
    const pattern = routePathToPattern(readApiPathAt(source, index));
    // Defence in depth: if normalisation ever yields an all-wildcard pattern
    // again, it must not be admitted to vouch for every route of that shape.
    if (!isUninformativePattern(pattern)) patterns.add(pattern);
  }

  return patterns;
}

/** True when any frontend pattern matches the route, segment by segment. */
export function patternMatchesRoute(routePattern, frontendPatterns) {
  if (frontendPatterns.has(routePattern)) {
    return true;
  }

  const routeSegments = routePattern.split("/");
  for (const frontendPattern of frontendPatterns) {
    const frontendSegments = frontendPattern.split("/");
    if (frontendSegments.length !== routeSegments.length) {
      continue;
    }
    const matches = routeSegments.every(
      (segment, index) =>
        segment === "*" || frontendSegments[index] === "*" || segment === frontendSegments[index],
    );
    if (matches) {
      return true;
    }
  }

  return false;
}
