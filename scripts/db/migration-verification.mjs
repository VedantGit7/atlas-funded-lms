import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const migrationNames = [
  "20260724120000_059_reports_insights_domains",
  "20260803140000_083_payment_report_fields",
  "20260803160000_084_learner_product_types",
  "20260803170000_085_batch_report_fields",
  "20260803180000_086_poll_report_fields",
];

export function classifyChecksum(checksum, source) {
  const lf = source.toString().replaceAll("\r\n", "\n");
  const hashes = { raw: sha256(source), lf: sha256(lf), crlf: sha256(lf.replaceAll("\n", "\r\n")) };
  const status = !/^[a-f0-9]{64}$/.test(checksum)
    ? "invalid-ledger-checksum"
    : checksum === hashes.raw
      ? "exact-match"
      : Object.values(hashes).includes(checksum)
        ? "line-ending-match"
        : "content-mismatch";
  return { status, hashes };
}

// A recovered prefix proves the historical bytes only when its full SHA256 matches.
// It does not authorize rewriting the applied migration or the database ledger.
export function recoverHistoricalPrefix(checksum, source) {
  if (!/^[a-f0-9]{64}$/.test(checksum)) return null;
  const lf = source.toString().replaceAll("\r\n", "\n");
  let lines = 0;
  for (let index = 0; index < lf.length; index++) {
    if (lf[index] !== "\n") continue;
    lines++;
    const prefix = lf.slice(0, index + 1);
    for (const [lineEnding, bytes] of [
      ["LF", prefix],
      ["CRLF", prefix.replaceAll("\n", "\r\n")],
    ]) {
      if (sha256(bytes) === checksum) {
        return {
          checksum,
          lineEnding,
          lines,
          byteLength: Buffer.byteLength(bytes),
          appendedSql: lf.slice(index + 1),
        };
      }
    }
  }
  return null;
}

export function compareCatalogs(reference, target) {
  const categories = {};
  for (const key of new Set([...Object.keys(reference), ...Object.keys(target)])) {
    const expected = new Set((reference[key] ?? []).map((row) => JSON.stringify(row)));
    const actual = new Set((target[key] ?? []).map((row) => JSON.stringify(row)));
    categories[key] = {
      referenceOnly: [...expected]
        .filter((row) => !actual.has(row))
        .sort()
        .map((row) => JSON.parse(row)),
      targetOnly: [...actual]
        .filter((row) => !expected.has(row))
        .sort()
        .map((row) => JSON.parse(row)),
    };
  }
  return {
    matches: Object.values(categories).every(
      (diff) => !diff.referenceOnly.length && !diff.targetOnly.length,
    ),
    categories,
  };
}

export function verificationVerdict(migrations, comparison) {
  const provenanceVerified =
    migrations.length > 0 &&
    migrations.every(
      (migration) =>
        migration.ledger.length === 1 &&
        migration.ledger[0].finished_at &&
        !migration.ledger[0].rolled_back_at &&
        migration.checks.length === 1 &&
        ["exact-match", "line-ending-match"].includes(migration.checks[0].status),
    );
  return { provenanceVerified, verified: provenanceVerified && comparison?.matches === true };
}

function dockerQuery(target, sql) {
  // No environment files, connection URLs, or arbitrary SQL input are accepted.
  // PostgreSQL itself enforces read-only access for every catalog/aggregate query.
  const result = execFileSync(
    "docker",
    [
      "exec",
      target.container,
      "psql",
      "-X",
      "-q",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      target.user,
      "-d",
      target.database,
      "-c",
      `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='30s'; ${sql}; ROLLBACK;`,
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 45_000 },
  );
  return JSON.parse(result.trim());
}

function snapshot(target, tables) {
  const tableList = tables.map((table) => `'${table}'`).join(",");
  return dockerQuery(
    target,
    `WITH selected AS (
    SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN (${tableList})
  ) SELECT json_build_object(
    'tables', (SELECT coalesce(json_agg(x ORDER BY x.name),'[]') FROM (
      SELECT relname AS name,relrowsecurity AS rls,relforcerowsecurity AS force_rls FROM selected) x),
    'columns', (SELECT coalesce(json_agg(x ORDER BY x.table_name,x.name),'[]') FROM (
      SELECT s.relname AS table_name,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,
        a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS default_value,
        a.attidentity AS identity,a.attgenerated AS generated,
        CASE WHEN a.attcollation=0 THEN NULL ELSE a.attcollation::regcollation::text END AS collation
      FROM selected s JOIN pg_attribute a ON a.attrelid=s.oid AND a.attnum>0 AND NOT a.attisdropped
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum) x),
    'constraints', (SELECT coalesce(json_agg(x ORDER BY x.table_name,x.name),'[]') FROM (
      SELECT s.relname AS table_name,c.conname AS name,c.contype AS type,c.convalidated AS validated,
        c.condeferrable AS deferrable,c.condeferred AS deferred,pg_get_constraintdef(c.oid,true) AS definition
      FROM selected s JOIN pg_constraint c ON c.conrelid=s.oid) x),
    'indexes', (SELECT coalesce(json_agg(x ORDER BY x.table_name,x.name),'[]') FROM (
      SELECT s.relname AS table_name,c.relname AS name,i.indisvalid AS valid,i.indisready AS ready,
        pg_get_indexdef(i.indexrelid) AS definition FROM selected s
      JOIN pg_index i ON i.indrelid=s.oid JOIN pg_class c ON c.oid=i.indexrelid) x),
    'policies', (SELECT coalesce(json_agg(x ORDER BY x.table_name,x.name),'[]') FROM (
      SELECT s.relname AS table_name,p.polname AS name,p.polpermissive AS permissive,p.polcmd AS command,
        ARRAY(SELECT CASE WHEN r=0 THEN 'public' ELSE pg_get_userbyid(r)::text END
          FROM unnest(p.polroles) r ORDER BY 1) AS roles,
        pg_get_expr(p.polqual,p.polrelid) AS using_expression,
        pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
      FROM selected s JOIN pg_policy p ON p.polrelid=s.oid) x),
    'grants', (SELECT coalesce(json_agg(x ORDER BY x.table_name,x.role,x.privilege),'[]') FROM (
      SELECT s.relname AS table_name,r.rolname AS role,v.privilege,
        has_table_privilege(r.rolname,s.oid,v.privilege) AS allowed
      FROM selected s CROSS JOIN pg_roles r
      CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)
      WHERE r.rolname IN ('atlas_app','atlas_worker','atlas_platform')) x),
    'triggers', (SELECT coalesce(json_agg(x ORDER BY x.table_name,x.name),'[]') FROM (
      SELECT s.relname AS table_name,t.tgname AS name,t.tgenabled AS enabled,pg_get_triggerdef(t.oid,true) AS definition
      FROM selected s JOIN pg_trigger t ON t.tgrelid=s.oid WHERE NOT t.tgisinternal) x)
  )`,
  );
}

function gitEvidence(name, checksum) {
  const path = `backend/prisma/migrations/${name}/migration.sql`;
  const history = execFileSync("git", ["rev-list", "--objects", "--all", "--reflog"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const objects = [
    ...new Set(
      history
        .split("\n")
        .filter((line) => line.endsWith(`/${name}/migration.sql`))
        .map((line) => line.split(" ")[0]),
    ),
  ];
  return {
    path,
    reachableAndReflogBlobChecks: objects.map((object) => ({
      object,
      ...classifyChecksum(checksum, execFileSync("git", ["cat-file", "blob", object])),
    })),
  };
}

export function verifyMigrationHistory(target, reference) {
  const ledger = dockerQuery(
    target,
    `SELECT coalesce(json_agg(x ORDER BY x.migration_name,x.started_at),'[]') FROM (
    SELECT migration_name,checksum,started_at,finished_at,rolled_back_at,applied_steps_count
    FROM public._prisma_migrations WHERE migration_name IN (${migrationNames.map((name) => `'${name}'`).join(",")})
  ) x`,
  );
  const tables = new Set();
  const migrations = migrationNames.map((name) => {
    const source = readFileSync(`backend/prisma/migrations/${name}/migration.sql`);
    for (const match of source
      .toString()
      .matchAll(/(?:CREATE TABLE(?: IF NOT EXISTS)?|ALTER TABLE)\s+"?([a-z_]+)"?/g))
      tables.add(match[1]);
    const records = ledger.filter((row) => row.migration_name === name);
    return {
      name,
      ledger: records,
      checks: records.map((row) => ({
        ...classifyChecksum(row.checksum, source),
        recoveredPrefix: recoverHistoricalPrefix(row.checksum, source),
        ...gitEvidence(name, row.checksum),
      })),
    };
  });
  const targetCatalog = snapshot(target, [...tables].sort());
  const referenceCatalog = reference ? snapshot(reference, [...tables].sort()) : null;
  const comparison = referenceCatalog ? compareCatalogs(referenceCatalog, targetCatalog) : null;
  const catalogCoverage = {
    expectedTables: tables.size,
    targetComplete: targetCatalog.tables.length === tables.size,
    referenceComplete: referenceCatalog ? referenceCatalog.tables.length === tables.size : false,
  };
  if (comparison)
    comparison.matches &&= catalogCoverage.targetComplete && catalogCoverage.referenceComplete;
  // This UPDATE was the only data transformation in the five migration files.
  // Counts identify present-day candidates, not proof of historical execution.
  const backfillCandidates = dockerQuery(
    target,
    `SELECT json_build_object(
    'rows_before_083',count(*) FILTER (WHERE created_at <= '2026-08-03T08:45:45.11444Z'::timestamptz),
    'missing_coupon_with_metadata',count(*) FILTER (WHERE created_at <= '2026-08-03T08:45:45.11444Z'::timestamptz AND coupon_amount_cents IS NULL AND nullif(metadata_json->>'discountCents','') IS NOT NULL),
    'missing_type_with_metadata',count(*) FILTER (WHERE created_at <= '2026-08-03T08:45:45.11444Z'::timestamptz AND product_type IS NULL AND (nullif(metadata_json->>'productType','') IS NOT NULL OR metadata_json->>'kind'='course_checkout')),
    'missing_gateway_with_metadata',count(*) FILTER (WHERE created_at <= '2026-08-03T08:45:45.11444Z'::timestamptz AND gateway_key IS NULL AND coalesce(nullif(metadata_json->>'gatewayKey',''),nullif(metadata_json->>'gateway_key','')) IS NOT NULL),
    'missing_title_with_metadata',count(*) FILTER (WHERE created_at <= '2026-08-03T08:45:45.11444Z'::timestamptz AND product_title IS NULL AND coalesce(nullif(metadata_json->>'productTitle',''),nullif(metadata_json->>'courseTitle','')) IS NOT NULL),
    'missing_title_with_matching_course',count(*) FILTER (WHERE po.created_at <= '2026-08-03T08:45:45.11444Z'::timestamptz AND product_title IS NULL AND EXISTS (SELECT 1 FROM courses c WHERE c.tenant_id=po.tenant_id AND c.id::text=po.metadata_json->>'courseId'))
  ) FROM payment_orders po`,
  );
  const verdict = verificationVerdict(migrations, comparison);
  return {
    checkedAt: new Date().toISOString(),
    target,
    reference: reference ?? null,
    scope:
      "Five historical migration gaps; current catalog comparison is not a historical application attestation.",
    ...verdict,
    currentCatalogMatchesReference: comparison?.matches ?? null,
    migrations,
    tables: [...tables].sort(),
    catalogCoverage,
    comparison,
    targetCatalogSha256: sha256(JSON.stringify(targetCatalog)),
    referenceCatalogSha256: referenceCatalog ? sha256(JSON.stringify(referenceCatalog)) : null,
    targetCatalogCounts: Object.fromEntries(
      Object.entries(targetCatalog).map(([key, rows]) => [key, rows.length]),
    ),
    backfillCandidates,
    historicalBackfillExecution: "unverifiable-without-historical-data-or-application-records",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (
        !/^--(container|database|user|reference-container|reference-database|reference-user|output)$/.test(
          args[i],
        ) ||
        !args[i + 1]
      )
        throw new Error("Expected named target options and optional reference/output options");
      options[args[i].slice(2)] = args[i + 1];
    }
    const target = { container: options.container, database: options.database, user: options.user };
    const reference = options["reference-container"]
      ? {
          container: options["reference-container"],
          database: options["reference-database"],
          user: options["reference-user"],
        }
      : null;
    for (const value of [...Object.values(target), ...Object.values(reference ?? {})]) {
      if (!value || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(value))
        throw new Error(
          "Explicit container, database and user names are required; URLs are not accepted",
        );
    }
    const report = verifyMigrationHistory(target, reference);
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (options.output) writeFileSync(options.output, output);
    else process.stdout.write(output);
    console.log(
      JSON.stringify({
        provenanceVerified: report.provenanceVerified,
        currentCatalogMatchesReference: report.currentCatalogMatchesReference,
        output: options.output ?? null,
      }),
    );
    // Fail closed: matching current state must not conceal missing historical provenance.
    if (!report.verified) process.exitCode = 2;
  } catch (error) {
    console.error(`Migration verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
