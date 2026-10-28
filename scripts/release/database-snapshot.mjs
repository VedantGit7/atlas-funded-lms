import { createHash } from "node:crypto";

/**
 * What a restore must reproduce exactly, read from one database: every table's
 * row count and content digest, sequences and their state, the tenant-table RLS
 * baseline, and a hash of the schema dump (definitions, ownership and grants).
 * Shared by the dump-and-restore drill (restore-drill.mjs) and the provider
 * backup drill (backup-restore-drill.mjs), so both compare the same things.
 *
 * `sql(database, statement)` returns psql's unaligned, tuples-only output, and
 * `schemaDump(database)` returns `pg_dump --schema-only --no-comments`.
 */
export function createSnapshot({ sql, schemaDump }) {
  const quote = (value) => `"${value.replaceAll('"', '""')}"`;
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  return (database) => {
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
    const schema = schemaDump(database)
      .replaceAll("\r\n", "\n")
      .split("\n")
      .filter((line) => !line.startsWith("--") && !/^\\(?:un)?restrict\b/.test(line))
      .join("\n")
      .trim();
    return { contents, sequences, security, schemaSha256: hash(schema) };
  };
}
