export type RuntimeEnvironment = "development" | "test" | "staging" | "production";

/** Independent deployment signals cannot be overridden by a development label. */
export function isDeployedRuntime(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env["NODE_ENV"] === "production" ||
    [env["APP_ENV"], env["RELEASE_ENV"]].some((value) =>
      ["production", "staging"].includes(value?.trim() ?? ""),
    ) ||
    env["VERCEL"] === "1" ||
    ["production", "preview"].includes(env["VERCEL_ENV"] ?? "")
  );
}

export function resolveRuntimeEnvironment(
  env: Record<string, string | undefined> = process.env,
): RuntimeEnvironment {
  const configured = env["APP_ENV"]?.trim();
  if (isDeployedRuntime(env)) {
    if (configured !== "production" && configured !== "staging") {
      throw new Error("APP_ENV must explicitly be production or staging in deployed runtimes.");
    }
    if (
      (env["VERCEL_ENV"] === "production" || env["RELEASE_ENV"] === "production") &&
      configured !== "production"
    ) {
      throw new Error("APP_ENV conflicts with the production deployment environment.");
    }
    return configured;
  }
  if (configured && configured !== "development" && configured !== "test") {
    throw new Error("APP_ENV must be development, test, staging or production.");
  }
  if (configured === "development" || configured === "test") return configured;
  return env["NODE_ENV"] === "test" ? "test" : "development";
}
