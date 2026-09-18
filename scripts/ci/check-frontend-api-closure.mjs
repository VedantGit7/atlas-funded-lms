#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  extractFrontendApiPatterns,
  patternMatchesRoute,
  routePathToPattern,
} from "./lib/api-path-patterns.mjs";

const repoRoot = process.cwd();
const apiRoot = join(repoRoot, "backend/apps/api/src/app/api");
const webRoot = join(repoRoot, "frontend/apps/web/src");
const manifestPath = join(repoRoot, "configs/ci/frontend-api-closure.json");

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walkFiles(path));
      continue;
    }
    if (path.endsWith("route.ts") || path.endsWith("route.tsx")) {
      files.push(path);
    }
  }
  return files;
}

function routeFileToApiPath(file) {
  const relativePath = relative(apiRoot, file).replace(/\\/g, "/");
  const withoutRoute = relativePath.replace(/\/route\.tsx?$/, "");
  if (!withoutRoute.startsWith("v1/")) {
    return null;
  }
  return `/api/${withoutRoute}`;
}

function collectFrontendSource(root) {
  const chunks = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) {
        chunks.push(readFileSync(path, "utf8"));
      }
    }
  }
  walk(root);
  return chunks.join("\n");
}

function isOpsOnly(apiPath, opsOnlyPrefixes) {
  return opsOnlyPrefixes.some((prefix) => apiPath === prefix || apiPath.startsWith(prefix));
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
/**
 * Every opsOnly entry must say why it is exempt.
 *
 * The list was bare strings. That is how a broken gate gets silenced quietly:
 * this checker reported 17 fully-wired /api/v1/reports/* routes as unwired
 * because of a parser bug, and the obvious "fix" would have been to paste them
 * in here, permanently excusing routes that were never broken. Requiring a
 * reason forces whoever adds an entry to state the mechanism, which is exactly
 * the step at which "the parser is wrong" becomes obvious.
 */
const opsOnlyPrefixes = (manifest.opsOnly ?? []).map((entry) => {
  if (typeof entry === "string") {
    throw new Error(
      `opsOnly entry "${entry}" must be { path, reason }: an exemption without a stated reason cannot be reviewed.`,
    );
  }
  if (!entry?.path || !entry?.reason) {
    throw new Error(`opsOnly entry is missing path or reason: ${JSON.stringify(entry)}`);
  }
  return entry.path;
});
/**
 * Routes the app really does call, but by a URL the API hands back at runtime.
 *
 * Kept separate from opsOnly on purpose. "No UI exists" and "the UI follows a
 * server-supplied link" are different facts, and collapsing them would hide a
 * genuinely missing screen behind an exemption meant for webhooks. The course
 * backup download is the worked example: ManageCourseBackupPanel fetches
 * `job.downloadUrl`, so the path is data rather than source text and no static
 * scan can see it.
 */
const runtimeLinkedPrefixes = (manifest.runtimeLinked ?? []).map((entry) => {
  if (typeof entry === "string" || !entry?.path || !entry?.reason) {
    throw new Error(`runtimeLinked entry must be { path, reason }: ${JSON.stringify(entry)}`);
  }
  return entry.path;
});
/**
 * Routes with no product surface yet, each with a reason and an owner.
 *
 * Distinct from opsOnly (never called from the app by design) and from
 * runtimeLinked (called through a server-supplied URL). These are backend
 * capability that a deliberate product decision has not yet given a home.
 *
 * They are NOT silenced. Every run prints them, so the debt stays in front of
 * whoever reads the gate instead of decaying into an allowlist nobody revisits
 * -- which is how the release-evidence file in this repo came to assert a clean
 * state that was sixty days stale.
 */
const pendingProductSurface = (manifest.pendingProductSurface ?? []).map((entry) => {
  if (typeof entry === "string" || !entry?.path || !entry?.reason || !entry?.owner) {
    throw new Error(
      "pendingProductSurface entry must be { path, reason, owner }: " + JSON.stringify(entry),
    );
  }
  return entry;
});
const pendingPaths = pendingProductSurface.map((entry) => entry.path);
const uiWiredRequired = manifest.uiWiredRequired ?? [];

const routeFiles = walkFiles(apiRoot);
const apiPaths = routeFiles.map(routeFileToApiPath).filter(Boolean);
const frontendSource = collectFrontendSource(webRoot);
const frontendPatterns = extractFrontendApiPatterns(frontendSource);

function frontendReferencesApi(apiPath) {
  return patternMatchesRoute(routePathToPattern(apiPath), frontendPatterns);
}

const failures = [];

for (const required of uiWiredRequired) {
  if (!apiPaths.some((path) => path === required || path.startsWith(`${required}/`))) {
    failures.push(`Missing backend route for required UI endpoint: ${required}`);
  }
  if (!frontendReferencesApi(required)) {
    failures.push(`Frontend does not reference required UI endpoint: ${required}`);
  }
}

const uncovered = apiPaths.filter((apiPath) => {
  if (isOpsOnly(apiPath, opsOnlyPrefixes)) {
    return false;
  }
  if (isOpsOnly(apiPath, pendingPaths)) {
    return false;
  }
  if (isOpsOnly(apiPath, runtimeLinkedPrefixes)) {
    return false;
  }
  return !frontendReferencesApi(apiPath);
});

if (pendingProductSurface.length > 0) {
  console.warn(
    "API closure: " +
      String(pendingProductSurface.length) +
      " route(s) have no product surface yet:",
  );
  for (const entry of pendingProductSurface) {
    console.warn("  - " + entry.path + " [" + entry.owner + "] " + entry.reason);
  }
}

/**
 * `--strict` exists so the local `ci` chain can enforce this without an inline
 * env var. Nothing in this repo sets one in an npm script — every other case
 * goes through `dotenv -e` — and `STRICT_API_CLOSURE=1 node ...` is not portable
 * to a Windows shell. The env var stays supported because the GitHub job
 * already sets it.
 */
const strict = process.env["STRICT_API_CLOSURE"] === "1" || process.argv.includes("--strict");
if (strict) {
  for (const apiPath of uncovered) {
    failures.push(`API route not wired in frontend and not listed ops-only: ${apiPath}`);
  }
} else if (uncovered.length > 0) {
  console.warn(
    `API closure advisory: ${uncovered.length} routes not referenced in frontend (pass --strict, or set STRICT_API_CLOSURE=1, to fail).`,
  );
}

if (failures.length > 0) {
  console.error("\nFrontend API closure check failed:\n");
  for (const failure of failures.slice(0, 40)) {
    console.error(`- ${failure}`);
  }
  if (failures.length > 40) {
    console.error(`... and ${failures.length - 40} more`);
  }
  process.exit(1);
}

console.log(
  `Frontend API closure OK (${apiPaths.length} routes scanned, strict=${strict ? "yes" : "no"}).`,
);
process.exit(0);
