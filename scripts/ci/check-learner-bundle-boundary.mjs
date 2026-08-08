#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const repoRoot = process.cwd();
const webAppRoot = join(repoRoot, "frontend/apps/web");
const nextStatic = join(webAppRoot, ".next/static/chunks");
const maxLearnerFirstLoadKb = Number(process.env["LEARNER_BUNDLE_BUDGET_KB"] ?? "150");

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

if (!statSync(nextStatic, { throwIfNoEntry: false })) {
  console.warn(
    "Skipping gzip chunk budget: .next/static/chunks not found. Run pnpm --filter @atlas/web build first.",
  );
  console.log("Learner import boundary OK.");
  process.exit(0);
}

let largestGzipKb = 0;
for (const entry of readdirSync(nextStatic)) {
  if (!entry.endsWith(".js")) {
    continue;
  }
  const bytes = readFileSync(join(nextStatic, entry));
  const gzipKb = gzipSync(bytes).length / 1024;
  largestGzipKb = Math.max(largestGzipKb, gzipKb);
}

if (largestGzipKb > maxLearnerFirstLoadKb) {
  console.error(
    `\nBundle budget failed: largest static chunk ${largestGzipKb.toFixed(1)} kB gzip exceeds ${maxLearnerFirstLoadKb} kB budget.`,
  );
  process.exit(1);
}

console.log(
  `Learner bundle checks OK (largest chunk ${largestGzipKb.toFixed(1)} kB gzip, budget ${maxLearnerFirstLoadKb} kB).`,
);
process.exit(0);
