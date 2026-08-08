#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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

function routePathToPattern(apiPath) {
  return apiPath
    .replace(/^\/api\/v1\//, "")
    .split("/")
    .map((segment) => (segment.startsWith("[") && segment.endsWith("]") ? "*" : segment))
    .join("/");
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

function extractFrontendApiPatterns(source) {
  const patterns = new Set();
  const literalMatches = source.matchAll(/\/api\/v1\/[a-zA-Z0-9_./?=&:-]+/g);
  for (const match of literalMatches) {
    patterns.add(routePathToPattern(match[0].split("?")[0] ?? match[0]));
  }

  const templateMatches = source.matchAll(/`\/api\/v1\/[^`]+`/g);
  for (const match of templateMatches) {
    const normalized = match[0]
      .slice(1, -1)
      .split("?")[0]
      .replace(/\$\{[^}]+\}/g, "*");
    patterns.add(routePathToPattern(normalized));
  }

  return patterns;
}

function patternMatchesRoute(routePattern, frontendPatterns) {
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
        segment === "*" ||
        frontendSegments[index] === "*" ||
        segment === frontendSegments[index],
    );
    if (matches) {
      return true;
    }
  }

  return false;
}

function isOpsOnly(apiPath, opsOnlyPrefixes) {
  return opsOnlyPrefixes.some((prefix) => apiPath === prefix || apiPath.startsWith(prefix));
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const opsOnlyPrefixes = manifest.opsOnly ?? [];
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
  return !frontendReferencesApi(apiPath);
});

const strict = process.env["STRICT_API_CLOSURE"] === "1";
if (strict) {
  for (const apiPath of uncovered) {
    failures.push(`API route not wired in frontend and not listed ops-only: ${apiPath}`);
  }
} else if (uncovered.length > 0) {
  console.warn(
    `API closure advisory: ${uncovered.length} routes not referenced in frontend (set STRICT_API_CLOSURE=1 to fail).`,
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
