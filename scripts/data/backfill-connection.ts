import { Client } from "pg";

/**
 * Shared by the one-off data backfills that run across tenants as the
 * database owner (audit M6 payout encryption, audit M8 SVG sanitizing).
 *
 * Tenant tables force row-level security, and their policies cover only the
 * application roles. An owner login without BYPASSRLS therefore sees no rows
 * at all: a backfill would report nothing to do on a table full of work, and
 * change nothing. The connection here is refused unless the login is a
 * superuser or has BYPASSRLS, and row security is turned off for the session,
 * so a read it would filter errors instead of returning less.
 */

/** A backfill that refused to run; the CLIs exit 2 for it. */
export class BackfillRefused extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function connectWithCompleteVisibility(
  databaseUrl: string | undefined,
  table: string,
): Promise<{ client: Client; database: string }> {
  if (!databaseUrl) {
    throw new BackfillRefused("DIRECT_DATABASE_URL (database owner) is required.");
  }
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const identity = (
      await client.query<{ database: string; complete_visibility: boolean }>(
        `select current_database() as database,
                (select rolsuper or rolbypassrls from pg_roles where rolname = current_user) as complete_visibility`,
      )
    ).rows[0];
    if (!identity?.complete_visibility) {
      throw new BackfillRefused(
        `This login cannot see every tenant's rows (${table} forces row-level security). ` +
          "Use the database owner with BYPASSRLS, or a superuser.",
      );
    }
    // A read row security would filter now errors instead of returning less.
    await client.query("set row_security = off");
    return { client, database: identity.database };
  } catch (error) {
    await client.end();
    throw error;
  }
}

/** `--tenant <id>`, repeatable: limit a run, e.g. to one tenant first. */
export function tenantArgs(argv: readonly string[]): string[] {
  return argv.flatMap((arg, index) => (arg === "--tenant" ? [argv[index + 1] ?? ""] : []));
}

export type TenantScope = {
  /** `and tenant_id = any($n)`, or nothing when the run covers every tenant. */
  sql: (position: number) => string;
  params: unknown[];
};

export function tenantScope(tenantIds: readonly string[] | undefined): TenantScope {
  const bad = tenantIds?.find((id) => !UUID.test(id));
  if (bad !== undefined) {
    throw new BackfillRefused(`--tenant expects a tenant id (uuid); got "${bad}".`);
  }
  if (!tenantIds || tenantIds.length === 0) return { sql: () => "", params: [] };
  return {
    sql: (position) => `and tenant_id = any($${String(position)}::uuid[])`,
    params: [tenantIds],
  };
}
