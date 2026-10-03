#!/usr/bin/env node
/**
 * Fails the build when a workspace package is imported by a subpath its
 * `exports` map does not declare.
 *
 * Found while wiring the outbox worker (audit finding C6): `@atlas/events` was
 * imported as `@atlas/events/services/outbox-worker.service` and
 * `@atlas/events/event-types`, neither of which was in its `exports` map. The
 * Next.js bundler resolves those through tsconfig `paths` and never complains,
 * so the breakage was invisible until code ran under plain Node resolution — the
 * worker process. Every such import is a latent crash for any non-Next runtime
 * (workers, scripts, migrations).
 */
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const SCAN_ROOTS = ["backend", "frontend", "scripts", "tests"];
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".next-e2e",
  ".next-perf",
  "dist",
  "generated",
  ".turbo",
]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

const IMPORT_PATTERN = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'](@atlas\/[^"']+)["']/g;

async function collectSourceFiles(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...(await collectSourceFiles(full)));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      found.push(full);
    }
  }
  return found;
}

/** Maps `@atlas/<name>` to its package.json, for workspace packages only. */
async function loadWorkspacePackages() {
  const packages = new Map();

  for (const base of [
    path.join(repoRoot, "backend", "packages"),
    path.join(repoRoot, "frontend", "packages"),
    path.join(repoRoot, "configs"),
  ]) {
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(base, entry.name, "package.json");
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        if (typeof manifest.name === "string" && manifest.name.startsWith("@atlas/")) {
          packages.set(manifest.name, { manifest, manifestPath });
        }
      } catch {
        // Not a package directory.
      }
    }
  }

  return packages;
}

function exportsAllow(manifest, subpath) {
  const map = manifest.exports;
  // No exports map means Node falls back to plain path resolution, which works.
  if (map === undefined || typeof map === "string") return true;

  const key = subpath === "" ? "." : `./${subpath}`;
  if (Object.prototype.hasOwnProperty.call(map, key)) return true;

  // Wildcard patterns, e.g. "./*": "./src/*.ts".
  for (const pattern of Object.keys(map)) {
    if (!pattern.includes("*")) continue;
    const [prefix, suffix = ""] = pattern.split("*");
    if (
      key.startsWith(prefix) &&
      key.endsWith(suffix) &&
      key.length >= prefix.length + suffix.length
    ) {
      return true;
    }
  }

  return false;
}

const packages = await loadWorkspacePackages();
if (packages.size === 0) {
  console.error(
    "check-package-exports: found no @atlas/* workspace packages; scan paths are stale.",
  );
  process.exit(1);
}

const files = (
  await Promise.all(SCAN_ROOTS.map((root) => collectSourceFiles(path.join(repoRoot, root))))
).flat();

if (files.length < 100) {
  console.error(`check-package-exports: scanned only ${files.length} files; scan paths are stale.`);
  process.exit(1);
}

const violations = new Map();

for (const file of files) {
  const source = readFileSync(file, "utf8");

  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1];
    const segments = specifier.split("/");
    const packageName = `${segments[0]}/${segments[1]}`;
    const subpath = segments.slice(2).join("/");

    const target = packages.get(packageName);
    if (!target) continue;
    if (exportsAllow(target.manifest, subpath)) continue;

    const key = `${packageName}/${subpath}`;
    if (!violations.has(key)) violations.set(key, new Set());
    violations.get(key).add(path.relative(repoRoot, file));
  }
}

if (violations.size > 0) {
  console.error("check-package-exports: imports not declared in the package's exports map:\n");
  for (const [specifier, importers] of [...violations].sort()) {
    console.error(`  ${specifier}`);
    for (const importer of [...importers].sort().slice(0, 5)) {
      console.error(`      ${importer}`);
    }
    if (importers.size > 5) console.error(`      ... and ${importers.size - 5} more`);
  }
  console.error(
    "\nThese resolve under the Next.js bundler but crash under plain Node " +
      "(workers, scripts). Add the subpath to the package's exports map.",
  );
  process.exit(1);
}

console.log(
  `check-package-exports: OK (${files.length} files, ${packages.size} workspace packages).`,
);
