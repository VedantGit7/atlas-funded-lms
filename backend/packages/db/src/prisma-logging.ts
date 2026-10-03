import { isDeployedRuntime } from "@atlas/core/config/runtime-environment";

/** Query diagnostics are explicit: synchronous query output can dominate local load tests. */
export function prismaLogLevels(
  env: Record<string, string | undefined> = process.env,
): Array<"query" | "error" | "warn"> {
  if (isDeployedRuntime(env)) return ["error"];
  return env["NODE_ENV"] === "development" && env["DATABASE_QUERY_LOGS"] === "1"
    ? ["query", "error", "warn"]
    : ["error", "warn"];
}
