import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma, withTenantTx } from "@atlas/db";

type GucRow = {
  tenant_id: string | null;
  actor_membership_id: string | null;
  request_id: string | null;
};

async function readTenantGucs(): Promise<GucRow> {
  const rows = await prisma.$queryRaw<GucRow[]>`
    SELECT
      current_setting('app.tenant_id', true) AS tenant_id,
      current_setting('app.actor_membership_id', true) AS actor_membership_id,
      current_setting('app.request_id', true) AS request_id
  `;

  return (
    rows[0] ?? {
      tenant_id: null,
      actor_membership_id: null,
      request_id: null,
    }
  );
}

describe("withTenantTx", () => {
  it("sets tenant, actor, and request context inside the transaction", async () => {
    const tenantId = randomUUID();
    const actorMembershipId = randomUUID();
    const requestId = randomUUID();

    const result = await withTenantTx(
      {
        tenantId,
        actorMembershipId,
        requestId,
      },
      async (tx) => {
        return tx.$queryRaw<GucRow[]>`
          SELECT
            current_setting('app.tenant_id', true) AS tenant_id,
            current_setting('app.actor_membership_id', true) AS actor_membership_id,
            current_setting('app.request_id', true) AS request_id
        `.then((rows) => rows[0]);
      },
    );

    expect(result?.tenant_id).toBe(tenantId);
    expect(result?.actor_membership_id).toBe(actorMembershipId);
    expect(result?.request_id).toBe(requestId);
  });

  it("does not leak tenant GUC values after transaction commit", async () => {
    const tenantId = randomUUID();
    const actorMembershipId = randomUUID();
    const requestId = randomUUID();

    await withTenantTx(
      {
        tenantId,
        actorMembershipId,
        requestId,
      },
      async (tx) => {
        await tx.$queryRaw`SELECT 1`;
      },
    );

    const afterCommit = await readTenantGucs();

    expect(afterCommit.tenant_id ?? "").toBe("");
    expect(afterCommit.actor_membership_id ?? "").toBe("");
    expect(afterCommit.request_id ?? "").toBe("");
  });

  it("rejects missing tenant context", async () => {
    await expect(
      withTenantTx(
        {
          tenantId: "",
          actorMembershipId: randomUUID(),
          requestId: randomUUID(),
        },
        async () => true,
      ),
    ).rejects.toThrow("Missing tenant context");
  });

  it("rejects missing request context", async () => {
    await expect(
      withTenantTx(
        {
          tenantId: randomUUID(),
          actorMembershipId: randomUUID(),
          requestId: "",
        },
        async () => true,
      ),
    ).rejects.toThrow("Missing request context");
  });

  it("rejects missing actor membership unless anonymous tenant read is explicitly allowed", async () => {
    await expect(
      withTenantTx(
        {
          tenantId: randomUUID(),
          requestId: randomUUID(),
        },
        async () => true,
      ),
    ).rejects.toThrow("Missing actor membership context");

    await expect(
      withTenantTx(
        {
          tenantId: randomUUID(),
          requestId: randomUUID(),
          allowAnonymousTenantRead: true,
        },
        async () => true,
      ),
    ).resolves.toBe(true);
  });

  it("applies transaction-local statement_timeout", async () => {
    const tenantId = randomUUID();
    const actorMembershipId = randomUUID();
    const requestId = randomUUID();

    const result = await withTenantTx(
      {
        tenantId,
        actorMembershipId,
        requestId,
        statementTimeoutMs: 7_500,
      },
      async (tx) => {
        const rows = await tx.$queryRaw<{ statement_timeout: string }[]>`
          SELECT current_setting('statement_timeout', true) AS statement_timeout
        `;
        return rows[0]?.statement_timeout ?? null;
      },
    );

    // Postgres may render ms as '7500ms' or '7.5s' depending on version/settings.
    expect(result === "7500ms" || result === "7.5s" || result === "7500").toBe(true);
  });
});
