import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { megabytes, readPostgresqlSettings } from "../../helpers/postgresql-settings";

/**
 * deploy/coolify/postgresql-settings.sql sizes each environment's database for
 * the Coolify resource limits it names. These keep its memory settings inside
 * those limits; coolify-compose.test.ts keeps the pools inside max_connections.
 */
const { sql, settings, cpus, memoryMb } = readPostgresqlSettings();
const runbook = readFileSync(resolve("docs/runbooks/coolify-deployment.md"), "utf8");

describe("PostgreSQL settings for the Coolify database", () => {
  it("names the Coolify limits it is sized for, as the runbook does", () => {
    expect(cpus).toBe(4);
    expect(memoryMb).toBe(6 * 1024);
    expect(runbook).toContain("4 CPUs and 6 GB");
  });

  it("is only ALTER SYSTEM settings and the statistics extension", () => {
    const statements = sql
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("--"));
    for (const statement of statements)
      expect(statement).toMatch(
        /^(ALTER SYSTEM SET [a-z_.]+ = .+;|CREATE EXTENSION IF NOT EXISTS pg_stat_statements;)$/,
      );
    expect(statements).toHaveLength(settings.size + 1);
  });

  it("keeps the memory settings inside the container's limit", () => {
    const shared = megabytes(settings.get("shared_buffers"));
    // A quarter is the usual share; much more starves the operating system's cache.
    expect(shared).toBeLessThanOrEqual(memoryMb * 0.3);
    expect(megabytes(settings.get("effective_cache_size"))).toBeLessThanOrEqual(memoryMb * 0.75);
    // Even every connection sorting at once, during a vacuum, stays inside it.
    const everyConnection =
      Number(settings.get("max_connections")) * megabytes(settings.get("work_mem"));
    expect(shared + everyConnection + megabytes(settings.get("maintenance_work_mem"))).toBeLessThan(
      memoryMb,
    );
  });

  it("loads pg_stat_statements and creates its view", () => {
    expect(settings.get("shared_preload_libraries")?.split(",")).toContain("pg_stat_statements");
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS pg_stat_statements;");
  });
});
