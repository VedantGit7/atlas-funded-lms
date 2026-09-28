import { describe, expect, it } from "vitest";
import { prismaLogLevels } from "../../../backend/packages/db/src/prisma-logging";

describe("Prisma query logging", () => {
  it("keeps errors and warnings without emitting every query by default in development", () => {
    expect(prismaLogLevels({ NODE_ENV: "development" })).toEqual(["error", "warn"]);
  });
  it("requires an explicit development-only opt-in for query diagnostics", () => {
    expect(prismaLogLevels({ NODE_ENV: "development", DATABASE_QUERY_LOGS: "1" })).toEqual([
      "query",
      "error",
      "warn",
    ]);
    expect(prismaLogLevels({ NODE_ENV: "development", DATABASE_QUERY_LOGS: "true" })).toEqual([
      "error",
      "warn",
    ]);
  });
  it("cannot enable SQL query output in a deployed runtime", () => {
    for (const env of [
      { NODE_ENV: "production", DATABASE_QUERY_LOGS: "1" },
      { NODE_ENV: "development", APP_ENV: "staging", DATABASE_QUERY_LOGS: "1" },
      { NODE_ENV: "development", VERCEL: "1", DATABASE_QUERY_LOGS: "1" },
    ])
      expect(prismaLogLevels(env)).not.toContain("query");
  });
});
