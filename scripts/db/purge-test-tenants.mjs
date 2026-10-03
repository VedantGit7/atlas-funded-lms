import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  cleanupConfiguration,
  cleanupClient,
  assertDatabaseIdentity,
  UUID,
} from "./test-cleanup-boundary.mjs";
import { PROTECTED_TENANT_SLUGS } from "./test-tenant-slugs.mjs";
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';

/** Delete only database-recorded IDs for one explicitly authorized disposable run. */
export async function purgeTestTenants(options = {}) {
  const env = options.env ?? process.env;
  const config = cleanupConfiguration(env);
  const runId = options.runId ?? env.TEST_RUN_ID;
  if (!UUID.test(runId ?? ""))
    throw new Error(
      "An explicit UUID runId / TEST_RUN_ID is required; slug-based sweeping is forbidden.",
    );
  const apply = options.apply === true;
  const client = cleanupClient(config);
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s'");
    await assertDatabaseIdentity(client, config);
    const run = (
      await client.query(
        "SELECT status FROM atlas_test_cleanup.runs WHERE id=$1::uuid FOR UPDATE",
        [runId],
      )
    ).rows[0];
    if (!run) throw new Error("Cleanup run is not registered in this disposable database.");
    const targets = (
      await client.query(
        `SELECT t.id::text, t.slug FROM public.tenants t
      JOIN atlas_test_cleanup.owned_rows r ON r.entity_id=t.id AND r.entity_kind='tenant'
      WHERE r.run_id=$1::uuid ORDER BY t.id FOR UPDATE OF t`,
        [runId],
      )
    ).rows;
    if (targets.some((row) => PROTECTED_TENANT_SLUGS.includes(row.slug)))
      throw new Error("Protected tenant encountered; entire cleanup refused.");
    const ids = targets.map((row) => row.id);
    const tables = (
      await client.query(`SELECT DISTINCT c.relname AS name FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attname='tenant_id' AND NOT a.attisdropped ORDER BY c.relname`)
    ).rows;
    const report = {
      runId,
      tenants: ids.length,
      sampleSlugs: targets.slice(0, 10).map((t) => t.slug),
      childRows: 0,
      principals: 0,
      retainedPrincipals: 0,
      applied: apply,
      perTable: [],
    };
    if (apply) await client.query("SET LOCAL session_replication_role = 'replica'");
    for (const table of tables) {
      const sql = apply
        ? `DELETE FROM public.${quote(table.name)} WHERE tenant_id=ANY($1::uuid[])`
        : `SELECT count(*)::int AS n FROM public.${quote(table.name)} WHERE tenant_id=ANY($1::uuid[])`;
      const result = await client.query(sql, [ids]);
      const rows = apply ? result.rowCount : result.rows[0].n;
      if (rows) report.perTable.push({ table: table.name, rows });
      report.childRows += rows;
    }
    if (apply) {
      await client.query("DELETE FROM public.tenants WHERE id=ANY($1::uuid[])", [ids]);
      // Keep normal FK protection when removing global identities. Never infer
      // ownership just because an existing user's last membership was a fixture.
      await client.query("SET LOCAL session_replication_role = 'origin'");
    }
    const owned = (
      await client.query(
        `SELECT p.id::text FROM public.auth_principals p
      JOIN atlas_test_cleanup.owned_rows r ON r.entity_kind='principal' AND r.entity_id=p.id
      WHERE r.run_id=$1::uuid AND NOT EXISTS (SELECT 1 FROM public.memberships m
        WHERE m.auth_principal_id=p.id ${apply ? "" : "AND NOT (m.tenant_id=ANY($2::uuid[]))"})
      ORDER BY p.id FOR UPDATE OF p`,
        apply ? [runId] : [runId, ids],
      )
    ).rows.map((r) => r.id);
    if (apply && owned.length) {
      // The row locks also block new FK references until commit. Inspect every
      // referencing key: CASCADE and SET NULL are not protective delete errors.
      const references = (
        await client.query(`SELECT n.nspname AS schema_name, c.relname AS table_name,
        fk.conname AS constraint_name, array_agg(child.attname::text ORDER BY key.ordinality) AS child_columns,
        array_agg(parent.attname::text ORDER BY key.ordinality) AS parent_columns
        FROM pg_constraint fk JOIN pg_class c ON c.oid=fk.conrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        CROSS JOIN LATERAL unnest(fk.conkey,fk.confkey) WITH ORDINALITY AS key(child_num,parent_num,ordinality)
        JOIN pg_attribute child ON child.attrelid=fk.conrelid AND child.attnum=key.child_num
        JOIN pg_attribute parent ON parent.attrelid=fk.confrelid AND parent.attnum=key.parent_num
        WHERE fk.contype='f' AND fk.confrelid='public.auth_principals'::regclass
        GROUP BY fk.oid,n.nspname,c.relname,fk.conname ORDER BY n.nspname,c.relname,fk.conname`)
      ).rows;
      for (const reference of references) {
        const match = reference.child_columns
          .map(
            (column, index) =>
              `child.${quote(column)}=parent.${quote(reference.parent_columns[index])}`,
          )
          .join(" AND ");
        const result = await client.query(
          `SELECT EXISTS (
          SELECT 1 FROM ${quote(reference.schema_name)}.${quote(reference.table_name)} child
          JOIN public.auth_principals parent ON ${match}
          WHERE parent.id=ANY($1::uuid[])) AS referenced`,
          [owned],
        );
        if (result.rows[0].referenced) {
          const error = new Error(
            `Owned principal is still referenced by ${reference.schema_name}.${reference.table_name} (${reference.constraint_name}); entire cleanup refused.`,
          );
          error.code = "TEST_CLEANUP_REFERENCED_PRINCIPAL";
          throw error;
        }
      }
      report.principals = (
        await client.query("DELETE FROM public.auth_principals WHERE id=ANY($1::uuid[])", [owned])
      ).rowCount;
    } else report.principals = owned.length;
    report.retainedPrincipals =
      (
        await client.query(
          `SELECT count(*)::int AS n FROM public.auth_principals p
      JOIN atlas_test_cleanup.owned_rows r ON r.entity_kind='principal' AND r.entity_id=p.id WHERE r.run_id=$1::uuid`,
          [runId],
        )
      ).rows[0].n - (apply ? 0 : owned.length);
    if (apply) {
      await client.query("DELETE FROM atlas_test_cleanup.owned_rows WHERE run_id=$1::uuid", [
        runId,
      ]);
      await client.query("UPDATE atlas_test_cleanup.runs SET status='cleaned' WHERE id=$1::uuid", [
        runId,
      ]);
      await client.query("COMMIT");
    } else await client.query("ROLLBACK");
    return report;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

const entry = process.argv[1];
if (entry && fileURLToPath(import.meta.url) === resolve(entry)) {
  const args = process.argv.slice(2);
  const index = args.indexOf("--run-id");
  const runId = index >= 0 ? args[index + 1] : process.env.TEST_RUN_ID;
  const allowed = args.filter((_, i) => i !== index && i !== index + 1);
  if (
    (allowed.some((arg) => arg !== "--apply") && index >= 0) ||
    (index < 0 && args.some((arg) => arg !== "--apply"))
  ) {
    throw new Error("Usage: purge-test-tenants.mjs [--apply] --run-id UUID");
  }
  purgeTestTenants({ apply: args.includes("--apply"), runId })
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error("[purge-test-tenants] cleanup refused or failed:", error.message);
      process.exitCode = 1;
    });
}
