import { createHash } from "node:crypto";

/**
 * Names for the statements Prisma sends, so PostgreSQL can reuse their plans.
 *
 * Prisma's pg adapter sends every statement unnamed, and PostgreSQL plans an
 * unnamed statement from scratch each time it runs. In the staging load test
 * planning was 78% of the database's time: 234 seconds against 67 seconds of
 * execution, and the three busiest statements (the membership gate, the
 * permission check and the lesson loader) each took about five times longer to
 * plan than to run (docs/engineering/staging-load-test-2026-11-07.md).
 *
 * A named statement is parsed once per connection (node-postgres remembers it),
 * and after five runs PostgreSQL switches to a generic plan when that is no
 * worse, so the statement stops being planned at all. Pool connections now stay
 * open for a minute between bursts (DATABASE_POOL_IDLE_TIMEOUT_MS), which is
 * what makes the reuse pay.
 *
 * Bounded and conservative:
 * - Only statements run DATABASE_STATEMENT_CACHE_MIN_USES times get a name, so
 *   one-off SQL never takes a slot.
 * - At most DATABASE_STATEMENT_CACHE_MAX names per pool, so each PostgreSQL
 *   backend holds at most that many prepared statements (0 turns naming off).
 * - Only SELECT, WITH, INSERT, UPDATE and DELETE: transaction control and SET
 *   stay unnamed.
 * - Nothing that selects or returns `*`. Its columns are fixed when it is
 *   prepared, so a migration adding a column while old processes still run
 *   would make it fail with "cached plan must not change result type" until
 *   the connection closed. Explicit columns are unaffected by an added column.
 *
 * Row-level security is unaffected: the policies read the tenant from
 * current_setting() when the statement runs, not when it is planned, and
 * PostgreSQL replans a cached statement when the role it was planned for changes
 * (tests/integration/db/statement-plan-reuse.test.ts).
 */

export const DEFAULT_STATEMENT_CACHE_MAX = 200;
export const DEFAULT_STATEMENT_CACHE_MIN_USES = 3;
/** Distinct statements whose uses are counted before they earn a name. */
const MAX_COUNTED = 5_000;
/** Longer statements are generated one-offs (bulk inserts, long IN lists). */
const MAX_SQL_LENGTH = 16_384;

/** DATABASE_STATEMENT_CACHE_MAX: 0 to 2000, else the default. */
export function statementCacheMax(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_STATEMENT_CACHE_MAX;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 2_000
    ? parsed
    : DEFAULT_STATEMENT_CACHE_MAX;
}

/** DATABASE_STATEMENT_CACHE_MIN_USES: 1 to 1000, else the default. */
export function statementCacheMinUses(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_STATEMENT_CACHE_MIN_USES;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1_000
    ? parsed
    : DEFAULT_STATEMENT_CACHE_MIN_USES;
}

const LEADING_COMMENTS = /^\s*(?:(?:--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)\s*)*/;
const PLANNABLE = /^(?:select|with|insert|update|delete)\b/i;
// `*` as a select-list or RETURNING item, optionally qualified ("t".* or
// "schema"."t".*), followed by a comma, FROM or the end. count(*) and
// arithmetic do not match.
const STAR_ITEM = /(?:^|[\s,(])(?:"?[a-z_][\w$]*"?\.)*\*\s*(?:,|\bfrom\b|$)/i;

/** Whether a statement may be given a name and kept prepared. */
export function isReusableStatement(sql: string): boolean {
  if (sql.length > MAX_SQL_LENGTH) return false;
  if (!PLANNABLE.test(sql.replace(LEADING_COMMENTS, ""))) return false;
  return !STAR_ITEM.test(sql);
}

/** The prepared-statement name for a statement: the same SQL always gets the same name. */
export function statementName(sql: string): string {
  return `atlas_${createHash("sha1").update(sql).digest("hex").slice(0, 24)}`;
}

/**
 * The adapter's statementNameGenerator: a name for a statement once it has run
 * minUses times, until max statements have one. One generator per pool.
 */
export function createStatementNameGenerator(options: {
  max: number;
  minUses: number;
}): (query: { sql: string }) => string | undefined {
  const names = new Map<string, string>();
  const uses = new Map<string, number>();
  return ({ sql }) => {
    const named = names.get(sql);
    if (named !== undefined) return named;
    if (names.size >= options.max || !isReusableStatement(sql)) return undefined;
    const count = (uses.get(sql) ?? 0) + 1;
    if (count < options.minUses) {
      if (uses.has(sql) || uses.size < MAX_COUNTED) uses.set(sql, count);
      return undefined;
    }
    uses.delete(sql);
    const name = statementName(sql);
    names.set(sql, name);
    return name;
  };
}

/** The generator for one of the application's pools, from the environment. */
export function statementNameGeneratorFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): (query: { sql: string }) => string | undefined {
  return createStatementNameGenerator({
    max: statementCacheMax(env["DATABASE_STATEMENT_CACHE_MAX"]),
    minUses: statementCacheMinUses(env["DATABASE_STATEMENT_CACHE_MIN_USES"]),
  });
}

/**
 * The generator in the shape @prisma/adapter-pg's types ask for. They declare
 * it as always returning a name, but the adapter (7.10, performIO) passes the
 * result straight to node-postgres as the query's `name`, where undefined is
 * an ordinary unnamed statement. Statements without a name rely on that.
 */
export function prismaStatementNameGenerator(
  env: NodeJS.ProcessEnv = process.env,
): (query: { sql: string }) => string {
  const generate = statementNameGeneratorFromEnv(env);
  return (query) => generate(query) as string;
}
