#!/usr/bin/env node

/**
 * Backup and restore drill (hardening programme Phase 5.2).
 *
 * `restore-validate.mjs` checks an environment that has *already* been restored
 * by hand — it takes a base URL and probes it over HTTP. It never performs a
 * restore, never times one, and cannot tell you whether the procedure works. So
 * "we have a restore script" was true while "we have ever restored anything"
 * was not, and RPO/RTO were assumptions.
 *
 * This performs the cycle end to end and times each phase:
 *
 *   1. dump the source database
 *   2. create a scratch target
 *   3. restore into it
 *   4. verify the restored copy is actually usable, not merely present
 *   5. drop the scratch target
 *
 * Step 4 is the part that distinguishes a drill from a file copy. A restore that
 * produces tables but loses row-level security would look successful and be a
 * tenant-isolation breach, so the verification asserts RLS is enabled *and*
 * forced, the `app` schema and `app.current_tenant_id()` survived, migration
 * history is intact, and row counts match the source.
 *
 * Scope, stated plainly: run against a developer database this proves the
 * *procedure* and produces a timed baseline. It is not the production drill —
 * that needs the real managed database and its backup mechanism, and remains
 * open as SEC-06 in the security exception register.
 *
 * Usage:
 *   pnpm release:restore:drill
 *   RESTORE_DRILL_SOURCE_DB=atlas_lms_dev pnpm release:restore:drill
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import process from "node:process";

const container = process.env["RESTORE_DRILL_CONTAINER"] ?? "atlas-postgres";
const sourceDb = process.env["RESTORE_DRILL_SOURCE_DB"] ?? "atlas_lms_dev";
const targetDb = process.env["RESTORE_DRILL_TARGET_DB"] ?? "atlas_lms_restore_drill";
const dbUser = process.env["RESTORE_DRILL_USER"] ?? "atlas";
const dumpPath = `/tmp/${targetDb}.dump`;
const outPath = process.env["RESTORE_DRILL_OUT"] ?? "restore-drill.json";

/** Tables whose row counts must survive the round trip. */
const COUNT_TABLES = ["tenants", "memberships", "roles", "entitlements", "_prisma_migrations"];

function inContainer(args, { input } = {}) {
  return execFileSync("docker", ["exec", "-i", container, ...args], {
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function psql(db, sql) {
  return inContainer(["psql", "-U", dbUser, "-d", db, "-t", "-A", "-c", sql]).trim();
}

function timed(label, fn) {
  const startedAt = Date.now();
  const value = fn();
  const durationMs = Date.now() - startedAt;
  console.log(`  ${label.padEnd(28)} ${(durationMs / 1000).toFixed(2)}s`);
  return { value, durationMs };
}

const failures = [];
const phases = {};

console.log(`Restore drill: ${sourceDb} -> ${targetDb} (container ${container})\n`);

try {
  // ---- 1. Source facts, so the restore has something to be checked against.
  const sourceCounts = {};
  for (const table of COUNT_TABLES) {
    sourceCounts[table] = Number(psql(sourceDb, `select count(*)::bigint from ${table}`));
  }
  const sourceTableCount = Number(
    psql(
      sourceDb,
      `select count(*)::bigint from information_schema.tables
        where table_schema='public' and table_type='BASE TABLE'`,
    ),
  );
  console.log(`source: ${sourceTableCount} tables, ${sourceCounts["tenants"]} tenants\n`);

  // ---- 2. Dump.
  phases.dump = timed("dump", () =>
    inContainer(["pg_dump", "-U", dbUser, "-d", sourceDb, "-Fc", "-f", dumpPath]),
  ).durationMs;

  const dumpBytes = Number(inContainer(["stat", "-c", "%s", dumpPath]).trim() || "0");

  // ---- 3. Fresh target.
  phases.createTarget = timed("create target", () => {
    inContainer([
      "psql",
      "-U",
      dbUser,
      "-d",
      "postgres",
      "-c",
      `drop database if exists ${targetDb}`,
    ]);
    inContainer([
      "psql",
      "-U",
      dbUser,
      "-d",
      "postgres",
      "-c",
      `create database ${targetDb} owner ${dbUser}`,
    ]);
  }).durationMs;

  // ---- 4. Restore.
  phases.restore = timed("restore", () => {
    try {
      inContainer(["pg_restore", "-U", dbUser, "-d", targetDb, "--no-owner", dumpPath]);
    } catch (error) {
      // pg_restore exits non-zero on benign role/ownership notices. Treat the
      // verification below as the arbiter rather than the exit code, but keep
      // the output so a real failure is not swallowed.
      const text = String(error.stdout ?? "") + String(error.stderr ?? "");
      if (/FATAL|could not connect|out of memory/i.test(text)) throw error;
      phases.restoreWarnings = text.split("\n").filter(Boolean).length;
    }
  }).durationMs;

  // ---- 5. Verify. A restore that loses RLS is worse than one that fails.
  phases.verify = timed("verify", () => {
    const restoredTables = Number(
      psql(
        targetDb,
        `select count(*)::bigint from information_schema.tables
          where table_schema='public' and table_type='BASE TABLE'`,
      ),
    );
    if (restoredTables !== sourceTableCount) {
      failures.push(`table count ${restoredTables} != source ${sourceTableCount}`);
    }

    for (const table of COUNT_TABLES) {
      const restored = Number(psql(targetDb, `select count(*)::bigint from ${table}`));
      if (restored !== sourceCounts[table]) {
        failures.push(`${table}: ${restored} rows restored, source had ${sourceCounts[table]}`);
      }
    }

    // The tenant-isolation guarantee has to survive the round trip.
    const unprotected = Number(
      psql(
        targetDb,
        `select count(*)::bigint
           from information_schema.columns c
           join pg_class pc on pc.relname = c.table_name
          where c.table_schema='public' and c.column_name='tenant_id'
            and (pc.relrowsecurity = false or pc.relforcerowsecurity = false)`,
      ),
    );
    if (unprotected > 0) {
      failures.push(`${unprotected} tenant table(s) restored without RLS enabled and forced`);
    }

    const tenantFn = psql(
      targetDb,
      `select count(*)::bigint from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='app' and p.proname='current_tenant_id'`,
    );
    if (Number(tenantFn) !== 1) {
      failures.push("app.current_tenant_id() missing from the restored database");
    }

    const policies = Number(psql(targetDb, `select count(*)::bigint from pg_policy`));
    if (policies === 0) failures.push("no RLS policies restored");

    phases.restoredTables = restoredTables;
    phases.restoredPolicies = policies;
  }).durationMs;

  // ---- 6. Clean up.
  phases.cleanup = timed("cleanup", () => {
    inContainer([
      "psql",
      "-U",
      dbUser,
      "-d",
      "postgres",
      "-c",
      `drop database if exists ${targetDb}`,
    ]);
    inContainer(["rm", "-f", dumpPath]);
  }).durationMs;

  const rtoMs = phases.dump + phases.createTarget + phases.restore + phases.verify;

  const report = {
    generatedAt: new Date().toISOString(),
    sourceDatabase: sourceDb,
    environment: "local-docker",
    productionDrill: false,
    note: "Proves the procedure and gives a timed baseline. NOT the production drill (SEC-06): that needs the managed database and its own backup mechanism.",
    dumpBytes,
    sourceTableCount,
    sourceCounts,
    phasesMs: phases,
    measuredRtoMs: rtoMs,
    ok: failures.length === 0,
    failures,
  };

  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    `\nrestored ${phases.restoredTables} tables, ${phases.restoredPolicies} RLS policies`,
  );
  console.log(`dump size: ${(dumpBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`measured RTO (dump+create+restore+verify): ${(rtoMs / 1000).toFixed(2)}s`);
  console.log(`written: ${outPath}`);

  if (failures.length > 0) {
    console.error("\nRestore drill FAILED:\n");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("\nRestore drill passed.");
  process.exit(0);
} catch (error) {
  console.error("\nRestore drill errored:", error instanceof Error ? error.message : error);
  try {
    inContainer([
      "psql",
      "-U",
      dbUser,
      "-d",
      "postgres",
      "-c",
      `drop database if exists ${targetDb}`,
    ]);
  } catch {
    // best effort
  }
  process.exit(1);
}
