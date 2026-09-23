import { assertIsolatedFixtureTarget } from "../e2e/isolated-target.mjs";

export function microbenchmarkSettings(env) {
  if (env.PERF_LOCAL_FIXTURE !== "1")
    throw new Error("Database microbenchmark requires PERF_LOCAL_FIXTURE=1");
  try {
    assertIsolatedFixtureTarget({ databaseUrl: env.DATABASE_URL, authUrl: "http://127.0.0.1" });
    if (env.PLATFORM_DATABASE_URL)
      assertIsolatedFixtureTarget({
        databaseUrl: env.PLATFORM_DATABASE_URL,
        authUrl: "http://127.0.0.1",
      });
  } catch {
    throw new Error("Microbenchmark requires valid disposable local database targets");
  }
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(env.PERF_TENANT_ID ?? ""))
    throw new Error("An explicit fixture PERF_TENANT_ID is required");
  const levels = (env.PERF_LEVELS ?? "1,2,5").split(",").map(Number);
  const seconds = Number(env.PERF_SECONDS ?? "6");
  if (
    !levels.length ||
    levels.length > 10 ||
    levels.some((n) => !Number.isInteger(n) || n < 1 || n > 200) ||
    !Number.isInteger(seconds) ||
    seconds < 1 ||
    seconds > 60
  )
    throw new Error("Invalid bounded microbenchmark levels or duration");
  return { levels, seconds, tenantId: env.PERF_TENANT_ID };
}
