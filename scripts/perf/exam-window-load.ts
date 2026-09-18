/**
 * Exam-window load harness (hardening programme Phase 5.1).
 *
 * The concurrency ceiling in this product has been *derived* rather than
 * measured everywhere except one point: audit finding C6 measured 0 successful
 * requests at 20 concurrent (pool deadlock) and 364 rps at 80 concurrent once
 * the nested transaction was removed. Everything else was projection.
 *
 * What this measures, and what it does not:
 *
 *   - It exercises the **shape of the route pipeline** — `withGlobalDb` for
 *     tenant/principal resolution, released, then `withTenantTx` for the
 *     handler — under rising concurrency. That is precisely the shape C6 broke,
 *     and the shape that determines how many simultaneous requests the process
 *     can hold before the connection pool starves.
 *   - It does **not** measure HTTP, TLS, serialisation, Supabase round-trips, or
 *     the network. Those sit outside the pool and would only lower the number.
 *   - Run against a developer machine it establishes a **floor and a regression
 *     baseline**, not a production ceiling. Production numbers require
 *     production-grade hardware and the real managed database.
 *
 * The workload models an exam window because that is the product's genuine peak:
 * a cohort of learners all writing answers inside the same few minutes, which is
 * read-then-write inside one transaction rather than a cache-friendly read.
 *
 * Usage:
 *   pnpm perf:exam-window
 *   PERF_LEVELS=1,10,40 PERF_SECONDS=5 pnpm perf:exam-window
 */

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import process from "node:process";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";

type LevelResult = {
  concurrency: number;
  completed: number;
  errors: number;
  durationMs: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  firstError?: string;
};

const LEVELS = (process.env["PERF_LEVELS"] ?? "1,5,10,20,40,80,160")
  .split(",")
  .map((v) => Number.parseInt(v.trim(), 10))
  .filter((v) => Number.isInteger(v) && v > 0);

const SECONDS_PER_LEVEL = Number.parseInt(process.env["PERF_SECONDS"] ?? "6", 10);

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

/**
 * One "request". Deliberately mirrors the two-phase connection use of
 * `createTenantRoute` rather than a single query: holding one connection while
 * acquiring a second is what deadlocked the pool, and a benchmark that used one
 * connection per operation would not have reproduced C6 at all.
 */
async function simulateExamAnswer(tenantId: string): Promise<void> {
  // Phase 1: global scope (tenant + principal resolution in the real pipeline).
  await withGlobalDb(async (db) => {
    await db.$queryRaw`SELECT 1`;
  });

  // Phase 2: tenant transaction (the handler).
  await withTenantTx(
    { tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
    async (tx) => {
      // A read the handler would do...
      await tx.$queryRaw`SELECT count(*)::int FROM memberships`;
      // ...and a write, because an exam window is not read-only.
      await tx.$executeRaw`
        INSERT INTO idempotency_records (
          tenant_id, idempotency_key, scope, request_fingerprint, status,
          response_json, response_omitted, completed_at
        )
        VALUES (
          ${tenantId}::uuid, ${`perf-${randomUUID()}`}, 'PERF /exam/answer',
          ${randomUUID()}, 'COMPLETED', '{}'::jsonb, false, now()
        )
      `;
    },
  );
}

async function runLevel(concurrency: number, tenantId: string): Promise<LevelResult> {
  const latencies: number[] = [];
  let errors = 0;
  let firstError: string | undefined;

  const deadline = Date.now() + SECONDS_PER_LEVEL * 1000;
  const startedAt = Date.now();

  async function worker(): Promise<void> {
    while (Date.now() < deadline) {
      const t0 = performance.now();
      try {
        await simulateExamAnswer(tenantId);
        latencies.push(performance.now() - t0);
      } catch (error) {
        errors += 1;
        firstError ??= error instanceof Error ? error.message.slice(0, 200) : String(error);
        // A starved pool fails fast and would otherwise spin this loop.
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  const durationMs = Date.now() - startedAt;
  latencies.sort((a, b) => a - b);

  return {
    concurrency,
    completed: latencies.length,
    errors,
    durationMs,
    rps: latencies.length / (durationMs / 1000),
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    maxMs: latencies[latencies.length - 1] ?? 0,
    ...(firstError ? { firstError } : {}),
  };
}

async function main(): Promise<void> {
  const tenantId = process.env["PERF_TENANT_ID"] ?? (await resolveAnyTenantId());
  if (!tenantId) {
    console.error("No tenant found. Seed a database first (pnpm db:seed).");
    process.exit(1);
  }

  console.log(`Exam-window load: tenant ${tenantId}`);
  console.log(`pool max: ${process.env["DATABASE_POOL_MAX"] ?? "20 (default)"}`);
  console.log(`levels: ${LEVELS.join(", ")} | ${SECONDS_PER_LEVEL}s each\n`);

  const results: LevelResult[] = [];
  for (const concurrency of LEVELS) {
    const result = await runLevel(concurrency, tenantId);
    results.push(result);
    console.log(
      `c=${String(concurrency).padStart(4)}  ` +
        `${result.rps.toFixed(0).padStart(6)} rps  ` +
        `p50 ${result.p50Ms.toFixed(1).padStart(7)}ms  ` +
        `p95 ${result.p95Ms.toFixed(1).padStart(8)}ms  ` +
        `p99 ${result.p99Ms.toFixed(1).padStart(8)}ms  ` +
        `errors ${String(result.errors).padStart(5)}` +
        (result.firstError ? `  (${result.firstError})` : ""),
    );
  }

  // Clean up the rows this run wrote.
  await withTenantTx(
    { tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
    async (tx) => {
      await tx.$executeRaw`DELETE FROM idempotency_records WHERE scope = 'PERF /exam/answer'`;
    },
  );

  const outPath = process.env["PERF_OUT"] ?? "perf-exam-window.json";
  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        poolMax: process.env["DATABASE_POOL_MAX"] ?? "20",
        secondsPerLevel: SECONDS_PER_LEVEL,
        note: "Route-pipeline shape (withGlobalDb then withTenantTx). Excludes HTTP and auth. Developer-machine numbers are a floor and a regression baseline, not a production ceiling.",
        results,
      },
      null,
      2,
    )}\n`,
  );

  const best = results.reduce((a, b) => (b.rps > a.rps ? b : a));
  const broke = results.find((r) => r.errors > 0);

  console.log(`\npeak: ${best.rps.toFixed(0)} rps at concurrency ${best.concurrency}`);
  console.log(
    broke
      ? `first errors at concurrency ${broke.concurrency}: ${broke.firstError ?? "unknown"}`
      : "no errors at any level tested",
  );
  console.log(`written: ${outPath}`);
}

async function resolveAnyTenantId(): Promise<string | null> {
  const rows = await withGlobalDb(
    async (db) =>
      db.$queryRaw<Array<{ id: string }>>`
        SELECT id::text FROM tenants WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1
      `,
  );
  return rows[0]?.id ?? null;
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
