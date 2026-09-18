#!/usr/bin/env node
/**
 * Fails the build when an outbox consumer group is not wired into the worker.
 *
 * Audit finding C6: ten `process*OutboxBatch` functions were exported and none
 * was reachable from deployed code, so every outbox event in the platform sat
 * undelivered forever. Wiring them up once is not enough — the eleventh consumer
 * group would silently repeat the bug. This guard makes that a build failure.
 */
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const serverDir = path.join(repoRoot, "backend", "apps", "api", "src", "server");
const registryPath = path.join(
  repoRoot,
  "backend",
  "apps",
  "api",
  "src",
  "worker",
  "outbox-processors.ts",
);

const EXPORT_PATTERN = /export\s+async\s+function\s+(process\w*OutboxBatch)\s*\(/g;

async function collectTsFiles(dir) {
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectTsFiles(full)));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      found.push(full);
    }
  }
  return found;
}

const registry = readFileSync(registryPath, "utf8");
const files = await collectTsFiles(serverDir);

const missing = [];
let total = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(EXPORT_PATTERN)) {
    const name = match[1];
    total += 1;
    if (!registry.includes(name)) {
      missing.push({ name, file: path.relative(repoRoot, file) });
    }
  }
}

// Vacuity guard: a refactor that moves these files must break this check loudly
// rather than pass by finding nothing. Ten groups exist as of Phase 2.
if (total < 10) {
  console.error(
    `check-outbox-worker-coverage: found only ${total} process*OutboxBatch exports under ` +
      `${path.relative(repoRoot, serverDir)}; expected at least 10. The scan path is probably stale.`,
  );
  process.exit(1);
}

if (missing.length > 0) {
  console.error("check-outbox-worker-coverage: outbox processors not registered with the worker:");
  for (const entry of missing) {
    console.error(`  - ${entry.name}  (${entry.file})`);
  }
  console.error(
    `\nAdd them to ${path.relative(repoRoot, registryPath)} or their events will never be delivered.`,
  );
  process.exit(1);
}

console.log(`check-outbox-worker-coverage: OK (${total} processors registered).`);
