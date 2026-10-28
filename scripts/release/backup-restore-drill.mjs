import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createSnapshot } from "./database-snapshot.mjs";

/**
 * Restores a real backup from R2 and proves it matches the live database
 * (launch plan task 2.4; docs/runbooks/coolify-deployment.md, "Backups and
 * restore drills"). Unlike restore-drill.mjs, which dumps and restores inside
 * one cluster, this takes the newest backup Coolify uploaded, restores it into
 * a throwaway PostgreSQL with no network, and compares it with the source: every
 * table's rows and content, sequences, schema with ownership and grants, RLS
 * coverage, the databases, and the logins with their password hashes, which an
 * all-databases (pg_dumpall) backup carries.
 *
 * It runs Docker against the server (DOCKER_HOST=ssh://...), so the server
 * needs nothing installed. The download runs there in the atlas-migrate image,
 * with a read-only R2 key passed through from this environment by name.
 */
const LOGINS = ["atlas", "atlas_app_login", "atlas_platform_login"];
const R2_VARIABLES = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
const NAME = /^[a-z][a-z0-9_-]{0,62}$/;

export function backupDrillConfiguration(env = process.env) {
  const environment = env.BACKUP_DRILL_ENV?.trim();
  const sourceDb = env.BACKUP_DRILL_SOURCE_DB?.trim() || "atlas_lms";
  const image = env.BACKUP_DRILL_MIGRATE_IMAGE?.trim();
  const dockerHost = env.BACKUP_DRILL_DOCKER_HOST?.trim();
  if (!environment || !NAME.test(environment))
    throw new Error("BACKUP_DRILL_ENV (staging or production) is required.");
  if (!NAME.test(sourceDb)) throw new Error("BACKUP_DRILL_SOURCE_DB is not a database name.");
  if (!image || !/^ghcr\.io\/[a-z0-9-]+\/atlas-migrate:[0-9a-f]{40}$/.test(image))
    throw new Error("BACKUP_DRILL_MIGRATE_IMAGE must be an atlas-migrate image tagged with a SHA.");
  if (!dockerHost || !/^ssh:\/\/[^\s/]+$/.test(dockerHost))
    throw new Error("BACKUP_DRILL_DOCKER_HOST must be ssh://user@server.");
  for (const name of R2_VARIABLES) if (!env[name]?.trim()) throw new Error(`${name} is required.`);
  if (env.BACKUP_DRILL_QUIESCED !== "1")
    throw new Error(
      "Nothing may write to the source after the backup: set BACKUP_DRILL_QUIESCED=1 to confirm.",
    );
  return { environment, sourceDb, image, dockerHost, runId: randomUUID().replaceAll("-", "") };
}

/** Restore errors other than the one every pg_dumpall restore into a fresh cluster raises. */
export function unexpectedRestoreErrors(stderr) {
  return stderr
    .split(/\r?\n/)
    .filter((line) => /\bERROR:/.test(line))
    .filter((line) => !/ERROR:\s+role "postgres" already exists/.test(line));
}

export function runBackupDrill({ environment, sourceDb, image, dockerHost, runId }) {
  const target = `atlas-backup-drill-${runId}`;
  const volume = `atlas-backup-drill-${runId}`;
  const report = {
    generatedAt: new Date().toISOString(),
    environment,
    sourceDatabase: sourceDb,
    productionDrill: environment === "production",
    scope:
      "The newest backup in R2, restored into an isolated PostgreSQL with no network and compared with the live source. Excludes application recovery, uploaded files and Auth.",
    backup: null,
    phasesMs: {},
    checks: {},
    cleanupComplete: false,
    ok: false,
    failures: [],
  };
  const dockerEnv = { ...process.env, DOCKER_HOST: dockerHost };
  const docker = (args, input) =>
    execFileSync("docker", args, {
      encoding: "utf8",
      env: dockerEnv,
      input,
      timeout: 1_800_000,
      maxBuffer: 256 * 1024 * 1024,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
  const psql = (container) => (database, statement) =>
    docker([
      "exec",
      container,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      database,
      "-A",
      "-t",
      "-c",
      statement,
    ]).trim();
  const snapshotIn = (container) =>
    createSnapshot({
      sql: psql(container),
      schemaDump: (database) =>
        docker([
          "exec",
          container,
          "pg_dump",
          "-U",
          "postgres",
          "-d",
          database,
          "--schema-only",
          "--no-comments",
        ]),
    });
  // Attributes and a digest of each login's password hash, never the hash itself.
  const logins = (container) =>
    psql(container)(
      "postgres",
      `SELECT coalesce(json_agg(json_build_object('role',rolname,'super',rolsuper,'inherit',rolinherit,'createrole',rolcreaterole,'createdb',rolcreatedb,'login',rolcanlogin,'bypassrls',rolbypassrls,'password',md5(coalesce(rolpassword,''))) ORDER BY rolname),'[]') FROM pg_authid WHERE rolname IN (${LOGINS.map((name) => `'${name}'`).join(",")})`,
    );
  const databases = (container) =>
    psql(container)(
      "postgres",
      "SELECT string_agg(datname, ',' ORDER BY datname) FROM pg_database WHERE NOT datistemplate",
    );
  let phase = "configuration";
  const timed = (name, fn) => {
    phase = name;
    const start = performance.now();
    try {
      return fn();
    } finally {
      report.phasesMs[name] = Math.round(performance.now() - start);
    }
  };
  let volumeCreated = false;
  let targetStarted = false;
  try {
    const source = timed("findSource", () => {
      const names = docker([
        "ps",
        "--filter",
        `network=atlas-${environment}`,
        "--filter",
        "ancestor=postgres:16-alpine",
        "--format",
        "{{.Names}}",
      ])
        .trim()
        .split("\n")
        .filter(Boolean);
      if (names.length !== 1)
        throw new Error(`Expected one PostgreSQL on atlas-${environment}, found ${names.length}.`);
      return names[0];
    });
    report.sourceContainer = source;
    timed("fetch", () => {
      docker(["volume", "create", "--label", `atlas.backup-drill=${runId}`, volume]);
      volumeCreated = true;
      const fetched = docker([
        "run",
        "--rm",
        "--user",
        "0",
        "-v",
        `${volume}:/out`,
        ...R2_VARIABLES.flatMap((name) => ["-e", name]),
        "--entrypoint",
        "node",
        image,
        "scripts/db/fetch-backup.mjs",
        "/out",
      ]);
      report.backup = JSON.parse(fetched.trim().split("\n").at(-1));
      report.backup.ageMinutes = Math.round(
        (Date.now() - Date.parse(report.backup.lastModified)) / 60_000,
      );
    });
    const sourceSnapshot = timed("sourceSnapshot", () => snapshotIn(source)(sourceDb));
    const sourceLogins = logins(source);
    const sourceDatabases = databases(source);
    report.sourceTableCount = sourceSnapshot.contents.length;
    report.sourceRowCount = sourceSnapshot.contents.reduce((sum, t) => sum + Number(t.rows), 0);
    timed("startTarget", () => {
      docker([
        "run",
        "-d",
        "--name",
        target,
        "--label",
        `atlas.backup-drill=${runId}`,
        "--network",
        "none",
        "-e",
        `POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}`,
        "-v",
        `${volume}:/drill:ro`,
        "postgres:16-alpine",
      ]);
      targetStarted = true;
      for (let attempt = 0; ; attempt += 1) {
        const ready = spawnSync(
          "docker",
          ["exec", target, "pg_isready", "-U", "postgres", "-h", "127.0.0.1", "-q"],
          { env: dockerEnv },
        );
        if (ready.status === 0) break;
        if (attempt > 60) throw new Error("The drill's PostgreSQL did not start.");
        execFileSync(process.execPath, ["-e", "setTimeout(() => {}, 1000)"]);
      }
    });
    timed("restore", () => {
      const restore = spawnSync(
        "docker",
        [
          "exec",
          target,
          "sh",
          "-c",
          "gunzip -c /drill/backup.sql.gz | psql -X -q -U postgres -d postgres",
        ],
        { env: dockerEnv, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
      );
      const unexpected = unexpectedRestoreErrors(restore.stderr ?? "");
      report.checks.restoreClean = restore.status === 0 && unexpected.length === 0;
      if (!report.checks.restoreClean)
        throw new Error(`Restore reported errors: ${unexpected.slice(0, 5).join(" | ")}`);
    });
    timed("verify", () => {
      const restored = snapshotIn(target)(sourceDb);
      report.checks.tableContentsMatch =
        JSON.stringify(restored.contents) === JSON.stringify(sourceSnapshot.contents);
      report.checks.sequencesMatch =
        JSON.stringify(restored.sequences) === JSON.stringify(sourceSnapshot.sequences);
      report.checks.schemaOwnershipGrantsMatch =
        restored.schemaSha256 === sourceSnapshot.schemaSha256;
      report.checks.securityMatches =
        JSON.stringify(restored.security) === JSON.stringify(sourceSnapshot.security);
      report.checks.loginsAndPasswordsMatch = logins(target) === sourceLogins;
      report.checks.databasesMatch = databases(target) === sourceDatabases;
      report.restoredTables = restored.contents.length;
      report.restoredPolicies = restored.security.policies;
      report.restoredSnapshotSha256 = createHash("sha256")
        .update(JSON.stringify(restored))
        .digest("hex");
      if (Object.values(report.checks).some((value) => !value))
        throw new Error("The restored copy differs from the source.");
    });
    report.databaseRecoveryDurationMs =
      report.phasesMs.startTarget + report.phasesMs.restore + report.phasesMs.verify;
  } catch (error) {
    report.failures.push(`${phase} failed: ${error.message}`);
  } finally {
    let cleanupOk = true;
    if (targetStarted) {
      let removed = false;
      try {
        const label = docker([
          "inspect",
          "--format",
          '{{index .Config.Labels "atlas.backup-drill"}}',
          target,
        ]).trim();
        // Only ever remove the container this run created.
        if (label === runId) {
          docker(["rm", "-f", "-v", target]);
          removed = true;
        }
      } catch {
        removed = false;
      }
      if (!removed) {
        cleanupOk = false;
        report.failures.push(`Could not remove ${target}; inspect it before removing it by hand.`);
      }
    }
    if (volumeCreated) {
      try {
        docker(["volume", "rm", volume]);
      } catch {
        cleanupOk = false;
        report.failures.push(`Could not remove volume ${volume}, which holds the backup.`);
      }
    }
    report.cleanupComplete = cleanupOk;
  }
  report.ok = report.failures.length === 0 && Object.keys(report.checks).length === 7;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let report;
  try {
    report = runBackupDrill(backupDrillConfiguration());
  } catch (error) {
    report = { ok: false, cleanupComplete: true, failures: [error.message] };
  }
  writeFileSync(
    process.env.BACKUP_DRILL_OUT || "backup-restore-drill.json",
    `${JSON.stringify(report, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}
