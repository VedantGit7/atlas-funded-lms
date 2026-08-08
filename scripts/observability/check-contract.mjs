#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const requiredPatterns = [
  /OBSERVABILITY_HASH_SALT/,
  /NEXT_PUBLIC_SENTRY_DSN/,
  /NEXT_PUBLIC_POSTHOG_KEY/,
  /BETTER_STACK_WORKER_HEARTBEAT_URL/,
  /RELEASE_HEALTH_BASE_URL/,
];

const forbiddenClientSecretPatterns = [
  /process\.env\[["']POSTHOG_SERVER_KEY["']\]/,
  /process\.env\.POSTHOG_SERVER_KEY/,
  /process\.env\[["']BETTER_STACK_WORKER_HEARTBEAT_URL["']\]/,
  /process\.env\.BETTER_STACK_WORKER_HEARTBEAT_URL/,
  /process\.env\[["']OBSERVABILITY_HASH_SALT["']\]/,
  /process\.env\.OBSERVABILITY_HASH_SALT/,
  /process\.env\[["']SENTRY_AUTH_TOKEN["']\]/,
  /process\.env\.SENTRY_AUTH_TOKEN/,
];

const failures = [];

const envExample = readFileSync(".env.example", "utf8");
for (const pattern of requiredPatterns) {
  if (!pattern.test(envExample)) {
    failures.push(`.env.example missing required reference: ${String(pattern)}`);
  }
}

const clientRoots = [
  "frontend/apps/web/src/components",
  "frontend/apps/web/src/features",
  "frontend/apps/web/src/app",
  "frontend/apps/web/src/observability",
];

function walkSync(directory) {
  try {
    return readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry).replaceAll("\\", "/");
      if (statSync(path).isDirectory()) {
        return walkSync(path);
      }
      return /\.(ts|tsx)$/.test(path) ? [path] : [];
    });
  } catch {
    return [];
  }
}

for (const root of clientRoots) {
  for (const file of walkSync(root)) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbiddenClientSecretPatterns) {
      if (pattern.test(content)) {
        failures.push(`${file} references server-only secret env: ${String(pattern)}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: requiredPatterns.length }, null, 2));
