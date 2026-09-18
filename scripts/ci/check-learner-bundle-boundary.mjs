#!/usr/bin/env node

/**
 * Learner bundle boundary and first-load budget (audit finding H16).
 *
 * Two checks live here:
 *
 *   1. Import boundary — no learner route may reach into platform or studio code.
 *   2. First-load budget — how much JavaScript a learner downloads before the
 *      page is interactive.
 *
 * The second check used to report **the largest single chunk anywhere in the
 * app** and call it the learner first-load budget. That number was 354.6 kB, and
 * it came from an admin reporting chunk that no learner ever downloads. It
 * measured neither "learner" nor "first load".
 *
 * What it measures now, per route, is the set Next actually sends for the
 * initial render: the shared root chunks from `build-manifest.json` plus the
 * route's own `entryJSFiles` from its client-reference manifest, gzipped. That
 * is directly comparable to the "First Load JS" column Next prints for webpack
 * builds, which Turbopack does not emit.
 *
 * The real numbers this exposed:
 *
 *   - shared root ............ 131.8 kB gz (under budget on its own)
 *   - learner median ......... 131.8 kB gz — most learner routes are server-rendered
 *   - heaviest learner routes . ~400 kB gz
 *
 * So the finding is real but differently shaped than recorded: it is not that
 * every learner page is 2.4x over, it is that the routes carrying the learner
 * shell are roughly 2.7x over while the rest are fine. No heavy third-party
 * library is responsible — `three`, `konva`, `ethers` and friends appear in no
 * learner entry chunk, and lucide-react tree-shakes correctly (178 of 3972
 * icons ship). The weight is the application's own client components.
 *
 * Because closing that gap is a frontend restructuring project rather than a
 * configuration fix, this enforces a **ratchet**: the measured maximum may never
 * exceed the recorded baseline, so the number can only fall. The distance to the
 * 150 kB target is printed on every run so it stays visible rather than being
 * quietly redefined as met.
 *
 * Update the baseline with `--update-baseline` after a genuine reduction.
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import process from "node:process";

const repoRoot = process.cwd();
const webAppRoot = join(repoRoot, "frontend/apps/web");
const nextRoot = join(webAppRoot, ".next");
const appServerRoot = join(nextRoot, "server", "app");
const baselinePath = join(repoRoot, "configs/learner-bundle-baseline.json");

/** The budget the product is aiming at, from plan/frontend-planning/performance.md. */
const targetKb = Number(process.env["LEARNER_BUNDLE_BUDGET_KB"] ?? "150");
const updateBaseline = process.argv.includes("--update-baseline");

/* ------------------------------------------------------------------ *
 * 1. Import boundary
 * ------------------------------------------------------------------ */

const forbiddenLearnerImports = [
  "features/platform/",
  "app/platform/",
  "features/studio/",
  "app/studio/",
  "components/shells/PlatformConsoleShell",
];

const learnerRoots = [
  join(webAppRoot, "src/app/page.tsx"),
  join(webAppRoot, "src/app/courses"),
  join(webAppRoot, "src/app/(learner)"),
  join(webAppRoot, "src/app/(auth)/login"),
];

function collectSourceFiles(directory) {
  const files = [];
  if (!statSync(directory).isDirectory()) {
    return [directory];
  }
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

const importFailures = [];
for (const root of learnerRoots) {
  if (!statSync(root, { throwIfNoEntry: false })) {
    continue;
  }
  for (const file of collectSourceFiles(root)) {
    const source = readFileSync(file, "utf8");
    for (const forbidden of forbiddenLearnerImports) {
      if (source.includes(forbidden)) {
        importFailures.push(`${file} imports forbidden learner boundary: ${forbidden}`);
      }
    }
  }
}

if (importFailures.length > 0) {
  console.error("\nLearner bundle boundary check failed:\n");
  for (const failure of importFailures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * 2. First-load budget
 * ------------------------------------------------------------------ */

/**
 * Missing build output is a hard failure. The previous version warned and
 * exited 0, which is exactly how a 2.4x budget breach stayed invisible through
 * several audit passes — the same skip-instead-of-fail pattern as H14.
 */
if (!existsSync(appServerRoot)) {
  console.error(
    "\nNo build output at frontend/apps/web/.next/server/app.\n" +
      "Run `pnpm --filter @atlas/web build` first. This is a failure, not a skip:\n" +
      "silently passing here is how the budget breach went unnoticed.",
  );
  process.exit(1);
}

const buildManifest = JSON.parse(readFileSync(join(nextRoot, "build-manifest.json"), "utf8"));
const rootChunks = (buildManifest.rootMainFiles ?? []).map((f) => f.replace(/^\/_next\//, ""));

const gzipCache = new Map();
function gzipKb(chunk) {
  const clean = chunk.replace(/^\/_next\//, "");
  const cached = gzipCache.get(clean);
  if (cached !== undefined) return cached;
  const path = join(nextRoot, clean);
  const value = existsSync(path) ? gzipSync(readFileSync(path)).length / 1024 : 0;
  gzipCache.set(clean, value);
  return value;
}

function collectManifests(directory, found = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      collectManifests(path, found);
      continue;
    }
    if (entry.endsWith("_client-reference-manifest.js")) found.push(path);
  }
  return found;
}

function parseManifest(path) {
  const source = readFileSync(path, "utf8");
  const assignment = source.indexOf("=", source.indexOf("__RSC_MANIFEST["));
  if (assignment === -1) return null;
  const payload = source
    .slice(assignment + 1)
    .trim()
    .replace(/;\s*$/, "");
  try {
    return JSON.parse(payload);
  } catch {
    try {
      // Some Next versions emit the manifest as a JSON-encoded string.
      return JSON.parse(JSON.parse(payload));
    } catch {
      return null;
    }
  }
}

/** Route groups whose routes a learner never loads. */
const NON_LEARNER = /^\/(admin|studio|platform|\(admin\)|\(studio\)|\(platform\))(\/|$)/;

const routes = [];
for (const manifestPath of collectManifests(appServerRoot)) {
  const manifest = parseManifest(manifestPath);
  if (!manifest) continue;

  const chunks = new Set(rootChunks);
  for (const files of Object.values(manifest.entryJSFiles ?? {})) {
    for (const file of files) chunks.add(String(file).replace(/^\/_next\//, ""));
  }

  let firstLoadKb = 0;
  for (const chunk of chunks) firstLoadKb += gzipKb(chunk);

  const route =
    "/" +
    relative(appServerRoot, manifestPath)
      .replace(/\\/g, "/")
      .replace(/_client-reference-manifest\.js$/, "")
      .replace(/\/?page$/, "")
      .replace(/\/$/, "");

  routes.push({ route, firstLoadKb });
}

if (routes.length === 0) {
  console.error("\nParsed no route manifests. The build output shape has changed.");
  process.exit(1);
}

const learnerRoutes = routes.filter((r) => !NON_LEARNER.test(r.route));
if (learnerRoutes.length === 0) {
  console.error("\nMatched no learner routes. The route-group naming has changed.");
  process.exit(1);
}

learnerRoutes.sort((a, b) => b.firstLoadKb - a.firstLoadKb);
const worst = learnerRoutes[0];
const sharedKb = rootChunks.reduce((sum, c) => sum + gzipKb(c), 0);

if (updateBaseline) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        maxLearnerFirstLoadKb: Number(worst.firstLoadKb.toFixed(1)),
        worstRoute: worst.route,
        sharedRootKb: Number(sharedKb.toFixed(1)),
        targetKb,
        note: "Ratchet baseline for H16. May only decrease. Regenerate with `pnpm ci:learner-bundle-boundary --update-baseline` after a real reduction.",
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Baseline written: ${worst.firstLoadKb.toFixed(1)} kB (${worst.route})`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(
    `\nMissing ${relative(repoRoot, baselinePath)}.\n` +
      "Generate it with `pnpm ci:learner-bundle-boundary --update-baseline`.",
  );
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const allowedKb = Number(baseline.maxLearnerFirstLoadKb);

console.log(`Learner import boundary OK.`);
console.log(
  `Shared root ${sharedKb.toFixed(1)} kB gz | ${learnerRoutes.length} learner routes measured`,
);
console.log(`Heaviest learner first load: ${worst.firstLoadKb.toFixed(1)} kB gz  ${worst.route}`);
for (const r of learnerRoutes.slice(1, 5)) {
  console.log(`  next: ${r.firstLoadKb.toFixed(1).padStart(7)} kB  ${r.route}`);
}

if (worst.firstLoadKb > allowedKb + 0.5) {
  console.error(
    `\nLearner first-load regression: ${worst.firstLoadKb.toFixed(1)} kB exceeds the ` +
      `recorded baseline of ${allowedKb.toFixed(1)} kB on ${worst.route}.\n` +
      "Reduce it, or run with --update-baseline only if the increase is deliberate and justified.",
  );
  process.exit(1);
}

if (worst.firstLoadKb > targetKb) {
  // Deliberately not a failure: the gap is a known, recorded shortfall (H16) and
  // a permanently red gate is a gate everyone learns to ignore. It is printed
  // every run so it cannot quietly become "the way things are".
  console.warn(
    `\nH16 OPEN: ${worst.firstLoadKb.toFixed(1)} kB is still ` +
      `${(worst.firstLoadKb - targetKb).toFixed(1)} kB over the ${targetKb} kB target ` +
      `(${(worst.firstLoadKb / targetKb).toFixed(1)}x).\n` +
      "The ratchet above prevents this getting worse. Closing it needs the learner\n" +
      "shell's client components split, not a config change.",
  );
} else {
  console.log(`\nH16 CLOSED: under the ${targetKb} kB target.`);
}

process.exit(0);
