import process from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { localEnv } from "../e2e/local-env.mjs";
import { assertIsolatedFixtureTarget } from "../e2e/isolated-target.mjs";

/** Public disposable credentials only; never inherits hosted service settings. */
export function localWebEnvironment(inherited = process.env) {
  const env = {};
  for (const key of [
    "PATH",
    "Path",
    "PATHEXT",
    "SYSTEMROOT",
    "SystemRoot",
    "WINDIR",
    "COMSPEC",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "LOCALAPPDATA",
    "APPDATA",
    "HOME",
  ]) {
    if (inherited[key] !== undefined) env[key] = inherited[key];
  }
  // Next automatically reads app dotenv files. Reserve their keys with empty
  // values so unrelated hosted credentials cannot fill gaps in this fixture.
  for (const directory of [".", "frontend/apps/web"]) {
    for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
      const path = resolve(directory, name);
      if (existsSync(path)) for (const key of Object.keys(parse(readFileSync(path)))) env[key] = "";
    }
  }
  Object.assign(env, localEnv(), {
    NODE_ENV: "production",
    APP_ENV: "test",
    ATLAS_PERF_BUILD: "1",
    PLATFORM_OPERATOR_ASSIGNMENTS: "",
  });
  env.DATABASE_URL = env.DATABASE_URL.replace(
    "atlas:atlas_e2e_only_password",
    "atlas_app_login:atlas_e2e_app_only",
  );
  env.PLATFORM_DATABASE_URL = env.PLATFORM_DATABASE_URL.replace(
    "atlas:atlas_e2e_only_password",
    "atlas_platform_login:atlas_e2e_platform_only",
  );
  env.DIRECT_DATABASE_URL = env.DATABASE_URL;
  delete env.E2E_OWNER_DATABASE_URL;
  assertIsolatedFixtureTarget({ databaseUrl: env.DATABASE_URL, authUrl: env.SUPABASE_URL });
  return env;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command !== "build")
    throw new Error(
      "Usage: local-web.mjs build. Serving a production build requires the full deployed-service configuration; this local fixture intentionally cannot bypass it.",
    );
  const result = spawnSync(
    process.execPath,
    [resolve("frontend/apps/web/node_modules/next/dist/bin/next"), "build"],
    {
      cwd: resolve("frontend/apps/web"),
      env: localWebEnvironment(),
      stdio: "inherit",
    },
  );
  process.exit(result.status ?? 1);
}
