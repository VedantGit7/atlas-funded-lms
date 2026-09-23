import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

// Deliberately fixed disposable target: never inherits application/hosted URLs.
const client = new pg.Client({
  connectionString:
    "postgres://postgres:atlas_f19_disposable_only@127.0.0.1:15439/atlas_f19_verification",
});
const root = resolve(import.meta.dirname, "../..");
const before = JSON.parse(
  readFileSync(
    resolve(root, "docs/engineering/audits/2026-09-20/f19-function-before.json"),
    "utf8",
  ),
);
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260920145340_harden_rls_auto_enable_execute.sql"),
  "utf8",
);

await client.connect();
try {
  const identity = (
    await client.query(
      "SELECT current_database() AS db, current_user AS role, current_setting('server_version_num')::integer AS version",
    )
  ).rows[0];
  assert.equal(identity.db, "atlas_f19_verification");
  assert.equal(identity.role, "postgres");
  assert.equal(Math.floor(identity.version / 10000), 17);
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '10s'");
  // A fresh CLI auth database may not install this optional Supabase helper.
  await client.query(migration);
  await client.query(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE f19_ddl_writer",
  );
  await client.query(before.definition);
  await client.query(
    "GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated, service_role",
  );
  await client.query(
    "CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable()",
  );
  const definition = (
    await client.query(
      "SELECT pg_get_functiondef('public.rls_auto_enable()'::regprocedure) AS definition",
    )
  ).rows[0].definition;
  await client.query(migration);
  const privileges = (
    await client.query(`SELECT
    has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') AS anon,
    has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') AS authenticated,
    has_function_privilege('service_role','public.rls_auto_enable()','EXECUTE') AS service,
    has_function_privilege('postgres','public.rls_auto_enable()','EXECUTE') AS owner,
    has_function_privilege('f19_ddl_writer','public.rls_auto_enable()','EXECUTE') AS inherited_public`)
  ).rows[0];
  assert.deepEqual(privileges, {
    anon: false,
    authenticated: false,
    service: true,
    owner: true,
    inherited_public: false,
  });
  await client.query(migration); // Rerunning the migration cannot widen access.
  assert.equal(
    (
      await client.query(
        "SELECT pg_get_functiondef('public.rls_auto_enable()'::regprocedure) AS definition",
      )
    ).rows[0].definition,
    definition,
  );

  for (const role of ["anon", "authenticated"]) {
    await client.query("SAVEPOINT call_denied");
    await client.query(`SET LOCAL ROLE ${role}`);
    await assert.rejects(client.query("SELECT public.rls_auto_enable()"), { code: "42501" });
    await client.query("ROLLBACK TO SAVEPOINT call_denied");
  }
  await client.query(
    "GRANT CREATE ON SCHEMA public TO f19_ddl_writer; SET LOCAL ROLE f19_ddl_writer",
  );
  await client.query("CREATE TABLE public.f19_normal (id integer)");
  await client.query("CREATE TABLE public.f19_as AS SELECT 1 AS id");
  await client.query("SELECT 1 AS id INTO public.f19_into");
  await client.query("CREATE TABLE public.f19_partitioned (id integer) PARTITION BY RANGE (id)");
  await client.query("RESET ROLE");
  const tables = (
    await client.query(
      "SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relname LIKE 'f19_%' ORDER BY relname",
    )
  ).rows;
  assert.equal(tables.length, 4);
  assert.ok(tables.every((table) => table.relrowsecurity));

  await client.query("SAVEPOINT unexpected_function");
  await client.query(
    "DROP EVENT TRIGGER ensure_rls; DROP FUNCTION public.rls_auto_enable(); CREATE FUNCTION public.rls_auto_enable() RETURNS integer LANGUAGE sql AS 'SELECT 1'",
  );
  await assert.rejects(client.query(migration), /Expected public.rls_auto_enable.*event_trigger/);
  await client.query("ROLLBACK TO SAVEPOINT unexpected_function");
} finally {
  try {
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
}

console.log(
  JSON.stringify(
    {
      postgresMajor: 17,
      clientExecuteRevoked: true,
      publicInheritanceRevoked: true,
      ownerAndServicePreserved: true,
      functionDefinitionUnchanged: true,
      idempotent: true,
      directCallsDenied: true,
      missingHelperSafe: true,
      unexpectedHelperRejected: true,
      rlsEnabledForAllFourDdlForms: true,
      fixtureRolledBack: true,
    },
    null,
    2,
  ),
);
