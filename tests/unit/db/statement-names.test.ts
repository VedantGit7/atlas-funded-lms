import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATEMENT_CACHE_MAX,
  DEFAULT_STATEMENT_CACHE_MIN_USES,
  createStatementNameGenerator,
  isReusableStatement,
  prismaStatementNameGenerator,
  statementCacheMax,
  statementCacheMinUses,
  statementName,
} from "../../../backend/packages/db/src/statement-names";

const gate = `with principal as (select ap.global_status from auth_principals ap where ap.id = $1::uuid)
select principal.global_status from (select 1) as one left join principal on true`;

describe("which statements may keep a name", () => {
  it.each([
    "select id::text from courses where id = $1::uuid",
    "  -- the gate\n" + gate,
    "/* lesson */ select l.id from lessons l",
    'SELECT "public"."auth_sessions"."id" FROM "public"."auth_sessions" WHERE "id" = $1',
    "insert into lesson_progress (id) values ($1)",
    "update lesson_progress set status = $1 where id = $2",
    "delete from tenant_usage_events where id = any($1::uuid[])",
    "select count(*)::int from enrollments where course_id = $1",
    "select json_agg(t.*) from tags t",
    "select a * b from numbers",
  ])("names %s", (sql) => {
    expect(isReusableStatement(sql)).toBe(true);
  });

  it.each([
    "BEGIN",
    "COMMIT",
    "ROLLBACK",
    "SET LOCAL ROLE atlas_app",
    "SAVEPOINT s1",
    "select * from courses",
    "SELECT j.* FROM outbox_delivery_jobs j JOIN outbox_events o ON o.id = j.outbox_event_id",
    'select "public"."t".*, 1 from "public"."t"',
    "insert into audit_log (id) values ($1) returning *",
    "update lessons set title = $1 where id = $2 RETURNING *",
    `select ${"x, ".repeat(6_000)}1`,
  ])("leaves %s unnamed", (sql) => {
    expect(isReusableStatement(sql)).toBe(false);
  });
});

describe("statement names", () => {
  it("is the same for the same SQL and different for different SQL", () => {
    expect(statementName(gate)).toBe(statementName(gate));
    expect(statementName(gate)).not.toBe(statementName(`${gate} `));
    expect(statementName(gate)).toMatch(/^atlas_[0-9a-f]{24}$/);
    // PostgreSQL truncates identifiers past 63 bytes, which could merge names.
    expect(statementName(gate).length).toBeLessThan(64);
  });

  it("names a statement only from its minUses-th run", () => {
    const name = createStatementNameGenerator({ max: 10, minUses: 3 });
    expect(name({ sql: gate })).toBeUndefined();
    expect(name({ sql: gate })).toBeUndefined();
    expect(name({ sql: gate })).toBe(statementName(gate));
    expect(name({ sql: gate })).toBe(statementName(gate));
  });

  it("stops naming new statements at max, and keeps the names it gave", () => {
    const name = createStatementNameGenerator({ max: 2, minUses: 1 });
    const statements = ["select 1", "select 2", "select 3"];
    expect(statements.map((sql) => name({ sql }))).toEqual([
      statementName("select 1"),
      statementName("select 2"),
      undefined,
    ]);
    expect(name({ sql: "select 1" })).toBe(statementName("select 1"));
  });

  it("names nothing with max 0", () => {
    const name = createStatementNameGenerator({ max: 0, minUses: 1 });
    expect(name({ sql: gate })).toBeUndefined();
  });

  it("never names a statement it must leave unnamed, however often it runs", () => {
    const name = createStatementNameGenerator({ max: 10, minUses: 1 });
    for (let index = 0; index < 5; index += 1) expect(name({ sql: "BEGIN" })).toBeUndefined();
  });

  it("counts a bounded number of distinct statements, so one-off SQL cannot grow it", () => {
    const name = createStatementNameGenerator({ max: 10, minUses: 2 });
    for (let index = 0; index < 6_000; index += 1) name({ sql: `select ${String(index)}` });
    // Past the counting bound a new statement is never counted, so never named.
    expect(name({ sql: "select 'late'" })).toBeUndefined();
    expect(name({ sql: "select 'late'" })).toBeUndefined();
    // One counted early still earns its name.
    expect(name({ sql: "select 0" })).toBe(statementName("select 0"));
  });
});

describe("settings", () => {
  it("defaults to 200 names after 3 runs", () => {
    expect(DEFAULT_STATEMENT_CACHE_MAX).toBe(200);
    expect(DEFAULT_STATEMENT_CACHE_MIN_USES).toBe(3);
    expect(statementCacheMax(undefined)).toBe(200);
    expect(statementCacheMinUses(undefined)).toBe(3);
  });

  it.each(["", " ", "-1", "2001", "1.5", "lots"])("uses the default max for %j", (value) => {
    expect(statementCacheMax(value)).toBe(200);
  });

  it.each(["", "0", "1001", "2.5", "x"])("uses the default minUses for %j", (value) => {
    expect(statementCacheMinUses(value)).toBe(3);
  });

  it("accepts 0 to turn naming off, and values in range", () => {
    expect(statementCacheMax("0")).toBe(0);
    expect(statementCacheMax("500")).toBe(500);
    expect(statementCacheMinUses("1")).toBe(1);
  });

  it("reads both settings for the adapter's generator", () => {
    const name = prismaStatementNameGenerator({
      DATABASE_STATEMENT_CACHE_MAX: "1",
      DATABASE_STATEMENT_CACHE_MIN_USES: "1",
    });
    expect(name({ sql: "select 1" })).toBe(statementName("select 1"));
    expect(name({ sql: "select 2" })).toBeUndefined();
  });
});
