import { describe, expect, it } from "vitest";
import { assertIsolatedFixtureTarget } from "../../../scripts/e2e/isolated-target.mjs";

describe("F16 isolated browser fixture target", () => {
  const valid = {
    databaseUrl: "postgres://atlas:test@127.0.0.1:15436/atlas_lms_e2e",
    authUrl: "http://127.0.0.1:54326",
  };
  it("allows only explicit local disposable database and auth targets", () => {
    expect(() => assertIsolatedFixtureTarget(valid)).not.toThrow();
    expect(() =>
      assertIsolatedFixtureTarget({
        ...valid,
        databaseUrl: "postgres://atlas:test@localhost:5432/atlas_lms_ci",
      }),
    ).not.toThrow();
  });
  it.each([
    { databaseUrl: "postgres://atlas:test@localhost:15432/atlas_lms_dev" },
    { databaseUrl: "postgres://atlas:test@database.example/atlas_lms_e2e" },
    { databaseUrl: "postgres://atlas:test@localhost/production" },
    { databaseUrl: "postgres://atlas:test@localhost/atlas_lms_e2e?host=hosted.example" },
    { databaseUrl: "postgres://atlas:test@localhost/atlas_lms_e2e?dbname=production" },
    { databaseUrl: "postgres://atlas:test@localhost/atlas_lms_e2e?port=5432" },
    { authUrl: "https://example.supabase.co" },
    { authUrl: "http://127.0.0.1.attacker.test:54326" },
  ])("rejects targets outside the isolated boundary: %j", (change) => {
    expect(() => assertIsolatedFixtureTarget({ ...valid, ...change })).toThrow();
  });
});
