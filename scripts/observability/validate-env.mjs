#!/usr/bin/env node

const requiredInProduction = ["OBSERVABILITY_HASH_SALT"];
const optionalKeys = [
  "RELEASE_ENV",
  "RELEASE_SHA",
  "RELEASE_VERSION",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "POSTHOG_SERVER_KEY",
  "BETTER_STACK_WORKER_HEARTBEAT_URL",
];

const deploymentEnv =
  process.env.RELEASE_ENV?.trim() ||
  process.env.APP_ENV?.trim() ||
  process.env.NODE_ENV?.trim() ||
  "development";

const failures = [];

if (deploymentEnv === "production") {
  for (const key of requiredInProduction) {
    if (!process.env[key]?.trim()) {
      failures.push(`${key} is required when RELEASE_ENV/APP_ENV is production`);
    }
  }
}

const configured = optionalKeys.filter((key) => Boolean(process.env[key]?.trim()));

const result = {
  ok: failures.length === 0,
  deploymentEnv,
  configured,
  failures,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exit(1);
}
