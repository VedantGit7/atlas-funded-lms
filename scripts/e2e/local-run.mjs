import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { localEnv } from "./local-env.mjs";
import { resolve } from "node:path";
const env = { ...process.env, ...localEnv() };
const [command, ...args] = process.argv.slice(2);
if (!["seed", "scenarios", "api", "web", "test", "probes"].includes(command))
  throw new Error("Usage: local-run.mjs seed|scenarios|api|web|test|probes");
if (command === "seed" || command === "scenarios") {
  if (command === "seed")
    execFileSync(process.execPath, ["scripts/e2e/seed-browser-users.mjs"], {
      env,
      stdio: "inherit",
    });
  Object.assign(env, parse(readFileSync(env.E2E_CREDENTIALS_PATH)));
  execFileSync(process.execPath, ["scripts/e2e/seed-browser-scenarios.mjs"], {
    env,
    stdio: "inherit",
  });
} else {
  if (existsSync(env.E2E_CREDENTIALS_PATH))
    Object.assign(env, parse(readFileSync(env.E2E_CREDENTIALS_PATH)));
  env.DATABASE_URL = env.DATABASE_URL.replace(
    "atlas:atlas_e2e_only_password",
    "atlas_app_login:atlas_e2e_app_only",
  );
  env.PLATFORM_DATABASE_URL = env.PLATFORM_DATABASE_URL.replace(
    "atlas:atlas_e2e_only_password",
    "atlas_platform_login:atlas_e2e_platform_only",
  );
  env.ATLAS_BROWSER_BUILD = "1";
  if (command === "test" || command === "probes")
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --require "${resolve("scripts/e2e/local-dns.cjs").replaceAll("\\", "/")}"`;
  const app = command === "api" ? "backend/apps/api" : "frontend/apps/web";
  const nodeArgs =
    command === "probes"
      ? ["scripts/e2e/verify-failure-probes.mjs"]
      : command === "test"
        ? ["node_modules/@playwright/test/cli.js", "test", ...args]
        : [
            resolve(`${app}/node_modules/next/dist/bin/next`),
            "dev",
            "-p",
            command === "api" ? "3101" : "3100",
          ];
  execFileSync(process.execPath, nodeArgs, {
    env,
    stdio: "inherit",
    cwd: command === "test" || command === "probes" ? process.cwd() : resolve(app),
  });
}
