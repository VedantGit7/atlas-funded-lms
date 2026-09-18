import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withPlatformScope } from "@atlas/db";

const describeWithPlatformDb = process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describe("withPlatformScope validation", () => {
  it("rejects missing reason", async () => {
    await expect(
      withPlatformScope(
        {
          principalId: randomUUID(),
          requestId: randomUUID(),
          requiredPermission: "platform.tenant.read",
          platformPermissions: ["platform.tenant.read"],
        },
        "too short",
        async () => true,
      ),
    ).rejects.toThrow("Platform-scope reason required");
  });

  it("rejects missing platform permission", async () => {
    await expect(
      withPlatformScope(
        {
          principalId: randomUUID(),
          requestId: randomUUID(),
          requiredPermission: "platform.tenant.manage",
          platformPermissions: ["platform.tenant.read"],
        },
        "Investigating tenant provisioning state",
        async () => true,
      ),
    ).rejects.toThrow("Platform permission denied");
  });

  it("allows platform wildcard permission", async () => {
    if (!process.env["PLATFORM_DATABASE_URL"]) {
      expect(true).toBe(true);
      return;
    }

    await expect(
      withPlatformScope(
        {
          principalId: randomUUID(),
          requestId: randomUUID(),
          requiredPermission: "platform.tenant.read",
          platformPermissions: ["platform.*"],
        },
        "Investigating platform tenant list",
        async () => true,
      ),
    ).resolves.toBe(true);
  });
});

describeWithPlatformDb("withPlatformScope database context", () => {
  it("sets platform GUC context inside the transaction", async () => {
    const principalId = randomUUID();
    const requestId = randomUUID();
    const tenantId = randomUUID();

    const result = await withPlatformScope(
      {
        principalId,
        requestId,
        tenantId,
        requiredPermission: "platform.tenant.read",
        platformPermissions: ["platform.tenant.read"],
        touchedTenantIds: [tenantId],
      },
      "Investigating tenant support context",
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{
            platform_scope: string | null;
            actor_principal_id: string | null;
            platform_actor_id: string | null;
            request_id: string | null;
            tenant_id: string | null;
          }>
        >`
          SELECT
            current_setting('app.platform_scope', true) AS platform_scope,
            current_setting('app.actor_principal_id', true) AS actor_principal_id,
            current_setting('app.platform_actor_id', true) AS platform_actor_id,
            current_setting('app.request_id', true) AS request_id,
            current_setting('app.tenant_id', true) AS tenant_id
        `;

        return rows[0];
      },
    );

    expect(result).toBeDefined();
    expect(result?.platform_scope).toBe("true");
    expect(result?.actor_principal_id).toBe(principalId);
    expect(result?.platform_actor_id).toBe(principalId);
    expect(result?.request_id).toBe(requestId);
    expect(result?.tenant_id).toBe(tenantId);
  });

  it("writes platform scope enter and exit audit rows on success", async () => {
    const principalId = randomUUID();
    const requestId = randomUUID();
    const tenantId = randomUUID();

    await withPlatformScope(
      {
        principalId,
        requestId,
        tenantId,
        requiredPermission: "platform.audit.read",
        platformPermissions: ["platform.audit.read"],
        touchedTenantIds: [tenantId],
      },
      "Reviewing platform audit visibility",
      async () => true,
    );

    const auditRows = await withPlatformScope(
      {
        principalId,
        requestId: randomUUID(),
        requiredPermission: "platform.audit.read",
        platformPermissions: ["platform.audit.read"],
      },
      "Verifying platform scope audit records",
      async (tx) => {
        return tx.auditEntry.findMany({
          where: {
            request_id: requestId,
            actor_principal_id: principalId,
            action: {
              in: ["platform.scope.enter", "platform.scope.exit"],
            },
          },
          orderBy: {
            occurred_at: "asc",
          },
        });
      },
    );

    // Both rows are written inside one transaction, and `occurred_at` defaults
    // to now() -- which in Postgres is transaction start time, so the two share
    // a timestamp exactly. `orderBy: occurred_at` therefore has no tie-break and
    // the row order is whatever the planner returns; this assertion passed by
    // luck and failed roughly one run in six.
    //
    // What withPlatformScope actually guarantees, and what this test exists to
    // protect, is that entering and leaving platform scope are both recorded.
    // The ordering claim was never verifiable from this data, so it is asserted
    // as a set rather than left as a coin flip. Making it verifiable would mean
    // storing clock_timestamp() rather than now(), which is a schema change to
    // the audit log and a decision of its own.
    expect(new Set(auditRows.map((row) => row.action))).toEqual(
      new Set(["platform.scope.enter", "platform.scope.exit"]),
    );
    expect(auditRows).toHaveLength(2);
  });
});
