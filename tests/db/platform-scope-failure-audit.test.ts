import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withPlatformScope } from "@atlas/db";

/**
 * withPlatformScope when the scoped work fails.
 *
 * Two bugs lived in the old catch block, both invisible in a passing run:
 *
 * 1. Error masking. A failed SQL statement aborts the Postgres transaction.
 *    The catch then wrote its failed-exit audit on that same transaction,
 *    which threw `25P02 current transaction is aborted` -- and that replaced
 *    the real error. Every platform route that hit a database error logged
 *    25P02 instead of the cause. Found while writing cost attribution: an
 *    UPDATE the platform role may not run surfaced as 25P02, not "permission
 *    denied".
 *
 * 2. No failure audit. Even when the transaction was not aborted, the rethrow
 *    rolled it back, taking the enter and failed-exit rows with it. A failed
 *    platform action left no audit trail at all.
 *
 * Audit rows are append-only (a trigger rejects DELETE), so this file cannot
 * clean them up; each test uses its own request id and reads only its rows.
 */

const databaseUrl = process.env["DATABASE_URL"];
const platformUrl = process.env["PLATFORM_DATABASE_URL"];
const describeWithDb = databaseUrl && platformUrl ? describe : describe.skip;

const REASON = "Platform scope failure audit test";

let owner: Client;

function ctx(requestId: string) {
  return {
    principalId: randomUUID(),
    requestId,
    requiredPermission: "platform.cost.manage" as const,
    platformPermissions: ["platform.cost.manage"] as const,
    route: "/test/platform-scope-failure",
  };
}

type AuditRow = { action: string; status: string | null; error_message: string | null };

async function auditRows(requestId: string): Promise<AuditRow[]> {
  const { rows } = await owner.query<AuditRow>(
    `select action,
            after_json->>'status' as status,
            metadata_json->>'errorMessage' as error_message
       from audit_entries
      where request_id = $1
      order by occurred_at, id`,
    [requestId],
  );
  return rows;
}

describeWithDb("withPlatformScope failure handling", () => {
  beforeAll(async () => {
    owner = new Client({ connectionString: databaseUrl });
    await owner.connect();
  });

  afterAll(async () => {
    await owner.end();
  });

  it("surfaces the database's own error, not 25P02", async () => {
    const requestId = randomUUID();
    // atlas_platform has SELECT/INSERT on the rate card but not UPDATE
    // (migration 106), so this fails inside the scope with permission denied.
    const attempt = withPlatformScope(
      ctx(requestId),
      REASON,
      (tx) => tx.$executeRaw`UPDATE platform_cost_rates SET unit_cost_usd = 0`,
    );

    await expect(attempt).rejects.toThrow(/permission denied/i);
    await expect(attempt).rejects.not.toThrow(/25P02|current transaction is aborted/i);
  });

  it("persists a failed scope exit after a database error", async () => {
    const requestId = randomUUID();
    await expect(
      withPlatformScope(
        ctx(requestId),
        REASON,
        (tx) => tx.$executeRaw`UPDATE platform_cost_rates SET unit_cost_usd = 0`,
      ),
    ).rejects.toThrow(/permission denied/i);

    const rows = await auditRows(requestId);
    // The enter row was part of the scope transaction and rolled back with the
    // work; the failure record is written afterwards and stands alone.
    expect(rows).toEqual([
      {
        action: "platform.scope.exit",
        status: "failed",
        error_message: expect.stringMatching(/permission denied/i) as unknown as string,
      },
    ]);
  });

  it("persists a failed scope exit when the work throws without touching the database", async () => {
    const requestId = randomUUID();
    await expect(
      withPlatformScope(ctx(requestId), REASON, async () => {
        await Promise.resolve();
        throw new Error("validation failed in the handler");
      }),
    ).rejects.toThrow("validation failed in the handler");

    const rows = await auditRows(requestId);
    expect(rows).toEqual([
      {
        action: "platform.scope.exit",
        status: "failed",
        error_message: "validation failed in the handler",
      },
    ]);
  });

  it("keeps the success path as it was: enter and completed exit, in one transaction", async () => {
    const requestId = randomUUID();
    const result = await withPlatformScope(ctx(requestId), REASON, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ one: number }>>`SELECT 1::int AS one`;
      return rows[0]?.one;
    });

    expect(result).toBe(1);
    expect((await auditRows(requestId)).map((row) => [row.action, row.status])).toEqual([
      ["platform.scope.enter", null],
      ["platform.scope.exit", "completed"],
    ]);
  });

  it("keeps the global audit hash chain intact across the failure write", async () => {
    // The chain is computed by the audit_entries_hash_chain trigger against the
    // latest committed row in the stream. A row written after a rollback must
    // link to that row, not to the rolled-back enter entry.
    const requestId = randomUUID();
    await expect(
      withPlatformScope(
        ctx(requestId),
        REASON,
        (tx) => tx.$executeRaw`UPDATE platform_cost_rates SET unit_cost_usd = 0`,
      ),
    ).rejects.toThrow(/permission denied/i);

    const { rows } = await owner.query<{ linked: boolean }>(
      `select exists (
         select 1 from audit_entries prev
          where prev.tenant_id is null and prev.entry_hash = failed.previous_hash
       ) as linked
         from audit_entries failed
        where failed.request_id = $1`,
      [requestId],
    );
    expect(rows).toEqual([{ linked: true }]);
  });
});
