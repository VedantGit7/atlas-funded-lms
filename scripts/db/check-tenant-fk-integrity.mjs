import { Client } from "pg";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { TENANT_FOREIGN_KEYS } from "./tenant-fk-spec.mjs";

/**
 * Find rows that the composite tenant foreign keys of audit M3 would reject.
 *
 *   TENANT_FK_INTEGRITY_DATABASE_URL=... pnpm db:tenant-fk:check
 *
 * Run it against the target database before deploying migrations 120/121:
 * migration 121 validates existing rows, and fails on any row this reports.
 * It also runs after the deploy, to confirm every constraint is validated.
 *
 * For each reference it counts child rows whose parent is missing and rows
 * whose parent exists but belongs to another tenant, with a few sample ids.
 * Read-only, and refuses to run without complete RLS visibility: an
 * RLS-filtered view would report a clean database that is not.
 */
export async function checkTenantForeignKeys(databaseUrl, { samples = 5 } = {}) {
  if (!databaseUrl) {
    throw new Error(
      "TENANT_FK_INTEGRITY_DATABASE_URL must explicitly select the database to inspect.",
    );
  }
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query(
      "SET LOCAL row_security=off; SET LOCAL statement_timeout='5min'; SET LOCAL lock_timeout='5s'",
    );
    const identity = (
      await client.query(`SELECT current_database() AS database,
        (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS complete_visibility`)
    ).rows[0];
    if (!identity.complete_visibility) {
      throw new Error(
        "Use a read-authorized owner/admin login with complete RLS visibility for this integrity check.",
      );
    }

    const present = new Map(
      (
        await client.query(
          `SELECT conname, convalidated FROM pg_constraint
            WHERE contype='f' AND conname = ANY($1::text[])`,
          [TENANT_FOREIGN_KEYS.map((fk) => fk.name)],
        )
      ).rows.map((row) => [row.conname, row.convalidated]),
    );

    const results = [];
    for (const fk of TENANT_FOREIGN_KEYS) {
      // Identifiers come from the static spec above, never from input.
      const { rows } = await client.query(
        `SELECT
           count(*) FILTER (WHERE p.id IS NULL AND other.id IS NULL)::int AS missing,
           count(*) FILTER (WHERE p.id IS NULL AND other.id IS NOT NULL)::int AS cross_tenant,
           (array_agg(c.id::text ORDER BY c.id) FILTER (WHERE p.id IS NULL))[1:$1] AS sample_ids
         FROM public.${fk.child} c
         LEFT JOIN public.${fk.parent} p ON p.tenant_id = c.tenant_id AND p.id = c.${fk.column}
         LEFT JOIN public.${fk.parent} other ON other.id = c.${fk.column}
         WHERE c.${fk.column} IS NOT NULL`,
        [samples],
      );
      const row = rows[0];
      results.push({
        ...fk,
        missing: row.missing,
        crossTenant: row.cross_tenant,
        sampleIds: row.sample_ids ?? [],
        constraint: present.has(fk.name)
          ? present.get(fk.name)
            ? "validated"
            : "not_valid"
          : "absent",
      });
    }
    await client.query("ROLLBACK");

    const violations = results.filter((result) => result.missing > 0 || result.crossTenant > 0);
    return {
      database: identity.database,
      clean: violations.length === 0,
      allValidated: results.every((result) => result.constraint === "validated"),
      violations,
      results,
    };
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  checkTenantForeignKeys(process.env["TENANT_FK_INTEGRITY_DATABASE_URL"])
    .then((report) => {
      for (const violation of report.violations) {
        console.log(
          `${violation.child}.${violation.column} -> ${violation.parent}: ` +
            `${String(violation.missing)} missing parent, ${String(violation.crossTenant)} other tenant ` +
            `(e.g. ${violation.sampleIds.join(", ")})`,
        );
      }
      const states = report.results.reduce((acc, result) => {
        acc[result.constraint] = (acc[result.constraint] ?? 0) + 1;
        return acc;
      }, {});
      console.log(
        `${report.database}: ${String(report.results.length)} tenant foreign keys checked; ` +
          `${String(report.violations.length)} with violations; constraints ${JSON.stringify(states)}.`,
      );
      process.exit(report.clean ? 0 : 1);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(2);
    });
}
