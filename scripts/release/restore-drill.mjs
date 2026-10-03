import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function restoreConfiguration(env = process.env) {
  const container = env.RESTORE_DRILL_CONTAINER?.trim();
  const sourceDb = env.RESTORE_DRILL_SOURCE_DB?.trim();
  const dbUser = env.RESTORE_DRILL_USER?.trim();
  const runId = randomUUID().replaceAll("-", "");
  const targetDb = env.RESTORE_DRILL_TARGET_DB || `atlas_restore_drill_${runId}`;
  if (!container || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(container))
    throw new Error("Explicit valid RESTORE_DRILL_CONTAINER is required.");
  if (!sourceDb || !/^[a-z][a-z0-9_]{0,62}$/.test(sourceDb))
    throw new Error("Explicit valid RESTORE_DRILL_SOURCE_DB is required.");
  if (!dbUser || !/^[a-z][a-z0-9_]{0,62}$/.test(dbUser))
    throw new Error("Explicit valid RESTORE_DRILL_USER is required.");
  if (targetDb === sourceDb || !/^atlas_restore_drill_[a-f0-9]{32}$/.test(targetDb))
    throw new Error(
      "Target must be a unique atlas_restore_drill UUID name different from the source.",
    );
  if (env.RESTORE_DRILL_QUIESCED !== "1")
    throw new Error("Stop source writes and explicitly set RESTORE_DRILL_QUIESCED=1.");
  return { container, sourceDb, dbUser, targetDb, runId };
}

export function runRestoreDrill({ container, sourceDb, dbUser, targetDb, runId }) {
  const dumpPath = `/tmp/atlas_restore_drill_${runId}.dump`;
  const marker = `atlas-restore-drill:${runId}`;
  const report = {
    generatedAt: new Date().toISOString(),
    sourceDatabase: sourceDb,
    targetDatabase: targetDb,
    environment: "local-docker",
    productionDrill: false,
    rpoMeasured: false,
    databaseConfigurationRestored: false,
    clusterRolesRestored: false,
    scope:
      "Quiesced local database dump and restoration in the same cluster; excludes database settings/ACLs/locale, cluster roles, managed backups, external Auth/storage and application recovery.",
    phasesMs: {},
    checks: {},
    cleanupComplete: false,
    ok: false,
    failures: [],
  };
  let targetCreated = false;
  let dumpCreated = false;
  let phase = "configuration";
  const docker = (...args) =>
    execFileSync("docker", ["exec", container, ...args], {
      encoding: "utf8",
      timeout: 900_000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
  const sql = (database, statement) =>
    docker(
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      dbUser,
      "-d",
      database,
      "-A",
      "-t",
      "-c",
      statement,
    ).trim();
  const quote = (value) => `"${value.replaceAll('"', '""')}"`;
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const timed = (name, fn) => {
    phase = name;
    const start = performance.now();
    try {
      return fn();
    } finally {
      report.phasesMs[name] = Math.round(performance.now() - start);
    }
  };
  const snapshot = (database) => {
    const tables = JSON.parse(
      sql(
        database,
        `/* restore-drill:tables */ SELECT coalesce(json_agg(t ORDER BY schema,name),'[]'::json) FROM (SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema') t`,
      ),
    );
    const contents = [];
    // Keep commands below Windows argument limits while avoiding one Docker process per table.
    for (let offset = 0; offset < tables.length; offset += 20) {
      const batch = tables.slice(offset, offset + 20);
      const statements = batch.map(
        ({ schema, name }) =>
          `/* restore-drill:rows */ SELECT json_build_object('rows',count(*)::text,'digest',md5(coalesce(string_agg(h,'' ORDER BY h),''))) FROM (SELECT md5(row_to_json(t)::text) h FROM ONLY ${quote(schema)}.${quote(name)} t) hashes;`,
      );
      const values = sql(database, statements.join("\n"))
        .split("\n")
        .map((line) => JSON.parse(line));
      if (values.length !== batch.length) throw new Error("Incomplete table snapshot.");
      contents.push(...batch.map((table, index) => ({ ...table, ...values[index] })));
    }
    const sequences = JSON.parse(
      sql(
        database,
        `/* restore-drill:sequences */ SELECT coalesce(json_agg(t ORDER BY schemaname,sequencename),'[]'::json) FROM (SELECT schemaname,sequencename,sequenceowner,start_value,min_value,max_value,increment_by,cycle,cache_size,last_value::text FROM pg_sequences WHERE schemaname !~ '^pg_' AND schemaname <> 'information_schema') t`,
      ),
    );
    for (const sequence of sequences) {
      sequence.state = JSON.parse(
        sql(
          database,
          `/* restore-drill:sequence-state */ SELECT json_build_object('last_value',last_value::text,'is_called',is_called) FROM ${quote(sequence.schemaname)}.${quote(sequence.sequencename)}`,
        ),
      );
    }
    const security = JSON.parse(
      sql(
        database,
        `/* restore-drill:security */ WITH tenant_tables AS (SELECT c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='tenant_id' AND NOT a.attisdropped)) SELECT json_build_object('tenantTables',(SELECT count(*) FROM tenant_tables),'unprotected',(SELECT count(*) FROM tenant_tables WHERE NOT relrowsecurity OR NOT relforcerowsecurity),'policies',(SELECT count(*) FROM pg_policy),'tenantFunction',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='current_tenant_id'))`,
      ),
    );
    const schema = docker("pg_dump", "-U", dbUser, "-d", database, "--schema-only", "--no-comments")
      .replaceAll("\r\n", "\n")
      .split("\n")
      .filter((line) => !line.startsWith("--") && !/^\\(?:un)?restrict\b/.test(line))
      .join("\n")
      .trim();
    return { contents, sequences, security, schemaSha256: hash(schema) };
  };
  try {
    timed("collisionCheck", () => {
      if (
        sql(
          "postgres",
          `/* restore-drill:exists */ SELECT count(*) FROM pg_database WHERE datname='${targetDb}'`,
        ) !== "0"
      )
        throw new Error("Target already exists.");
    });
    const source = timed("sourceSnapshot", () => snapshot(sourceDb));
    report.checks.securityBaseline =
      source.contents.length > 0 &&
      source.security.tenantTables > 0 &&
      source.security.unprotected === 0 &&
      source.security.policies > 0 &&
      source.security.tenantFunction === 1;
    if (!report.checks.securityBaseline) throw new Error("Source security baseline failed.");
    report.dataCoverage = Object.fromEntries(
      ["tenants", "tenant_domains", "tenant_usage_events"].map((name) => [
        name,
        Number(
          source.contents.find((table) => table.schema === "public" && table.name === name)?.rows ??
            0,
        ),
      ]),
    );
    report.checks.applicationDataPresent = Object.values(report.dataCoverage).every(
      (rows) => rows >= 2,
    );
    if (!report.checks.applicationDataPresent)
      throw new Error("Missing representative application data.");
    report.sourceTableCount = source.contents.length;
    report.sourceRowCount = source.contents.reduce((sum, table) => sum + Number(table.rows), 0);
    report.sourceSnapshotSha256 = hash(JSON.stringify(source));
    timed("dump", () => {
      docker("touch", dumpPath);
      dumpCreated = true;
      docker("chmod", "600", dumpPath);
      docker("pg_dump", "-U", dbUser, "-d", sourceDb, "-Fc", "-f", dumpPath);
      report.dumpBytes = Number(docker("stat", "-c", "%s", dumpPath).trim());
      if (!(report.dumpBytes > 0)) throw new Error("Empty dump.");
    });
    timed("sourceQuiescenceCheck", () => {
      report.checks.sourceUnchanged = JSON.stringify(snapshot(sourceDb)) === JSON.stringify(source);
      if (!report.checks.sourceUnchanged) throw new Error("Source changed.");
    });
    timed("createTarget", () => {
      sql("postgres", `CREATE DATABASE ${quote(targetDb)} OWNER ${quote(dbUser)}`);
      targetCreated = true;
      sql("postgres", `COMMENT ON DATABASE ${quote(targetDb)} IS '${marker}'`);
    });
    timed("restore", () =>
      docker(
        "pg_restore",
        "-U",
        dbUser,
        "-d",
        targetDb,
        "--exit-on-error",
        "--single-transaction",
        dumpPath,
      ),
    );
    timed("verify", () => {
      const restored = snapshot(targetDb);
      report.checks.tableContentsMatch =
        JSON.stringify(restored.contents) === JSON.stringify(source.contents);
      report.checks.sequencesMatch =
        JSON.stringify(restored.sequences) === JSON.stringify(source.sequences);
      report.checks.schemaOwnershipGrantsMatch = restored.schemaSha256 === source.schemaSha256;
      report.checks.securityMatches =
        JSON.stringify(restored.security) === JSON.stringify(source.security);
      report.restoredTables = restored.contents.length;
      report.restoredPolicies = restored.security.policies;
      report.restoredSnapshotSha256 = hash(JSON.stringify(restored));
      if (Object.values(report.checks).some((value) => !value))
        throw new Error("Restored snapshot differs.");
    });
    report.databaseRecoveryDurationMs =
      report.phasesMs.createTarget + report.phasesMs.restore + report.phasesMs.verify;
  } catch {
    report.failures.push(`${phase} failed; no restore success is claimed.`);
  } finally {
    let cleanupOk = true;
    if (targetCreated) {
      try {
        const actual = sql(
          "postgres",
          `/* restore-drill:ownership */ SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname='${targetDb}'`,
        );
        if (actual !== marker) {
          cleanupOk = false;
          report.failures.push("Target ownership changed; no database was dropped.");
        } else {
          sql("postgres", `DROP DATABASE ${quote(targetDb)}`);
        }
      } catch {
        cleanupOk = false;
        report.failures.push(
          "Owned target cleanup failed; inspect its ownership before manual removal.",
        );
      }
    }
    if (dumpCreated) {
      try {
        docker("rm", "-f", dumpPath);
      } catch {
        cleanupOk = false;
        report.failures.push("Owned dump cleanup failed.");
      }
    }
    report.cleanupComplete = cleanupOk;
  }
  report.ok = report.failures.length === 0 && report.checks.securityBaseline === true;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let report;
  try {
    report = runRestoreDrill(restoreConfiguration());
  } catch (error) {
    report = {
      ok: false,
      productionDrill: false,
      cleanupComplete: true,
      failures: [error.message],
    };
  }
  writeFileSync(
    process.env.RESTORE_DRILL_OUT || "restore-drill.json",
    `${JSON.stringify(report, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}
