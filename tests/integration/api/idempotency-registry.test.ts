import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  fingerprintRequest,
  purgeExpiredIdempotencyRecords,
  withIdempotency,
} from "@atlas/api/idempotency-registry";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Audit finding M10 — central idempotency registry.
 *
 * 188 routes declared `idempotency: "required"` while 11 tables carried an
 * `idempotency_key` column, so on most of them a replay wrote twice. These
 * exercise the registry against a real database, because the guarantee is a
 * unique index and a transaction boundary rather than application logic.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const claimFor = (key: string, body: unknown) => ({
  idempotencyKey: key,
  scope: "POST /api/v1/test",
  requestFingerprint: fingerprintRequest({ method: "POST", path: "/api/v1/test", body }),
});

describeWithDb("idempotency registry (M10)", () => {
  it("runs the handler once and replays the stored response", async () => {
    const fixture = await createTenantIsolationFixture();
    const key = `idem-${randomUUID()}`;
    let calls = 0;

    const first = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      withIdempotency(
        tx,
        {
          tenantId: fixture.tenantA.tenantId,
          actorMembershipId: fixture.tenantA.membershipId,
          ...claimFor(key, { a: 1 }),
        },
        () => {
          calls += 1;
          return Promise.resolve({ data: { id: "created-1", calls } });
        },
      ),
    );

    const second = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      withIdempotency(
        tx,
        {
          tenantId: fixture.tenantA.tenantId,
          actorMembershipId: fixture.tenantA.membershipId,
          ...claimFor(key, { a: 1 }),
        },
        () => {
          calls += 1;
          return Promise.resolve({ data: { id: "created-2", calls } });
        },
      ),
    );

    expect(calls, "handler must run exactly once").toBe(1);
    expect(second).toEqual(first);
    expect((second as { data: { id: string } }).data.id).toBe("created-1");
  });

  it("rejects the same key used for a different request", async () => {
    const fixture = await createTenantIsolationFixture();
    const key = `idem-${randomUUID()}`;

    await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      withIdempotency(
        tx,
        {
          tenantId: fixture.tenantA.tenantId,
          actorMembershipId: fixture.tenantA.membershipId,
          ...claimFor(key, { amount: 100 }),
        },
        () => Promise.resolve({ ok: true }),
      ),
    );

    // Same key, different body. Replaying the first response would be wrong and
    // running the handler would be a second write, so the only safe answer is to
    // refuse.
    await expect(
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
        withIdempotency(
          tx,
          {
            tenantId: fixture.tenantA.tenantId,
            actorMembershipId: fixture.tenantA.membershipId,
            ...claimFor(key, { amount: 999 }),
          },
          () => Promise.resolve({ ok: true }),
        ),
      ),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("does not leave a claim behind when the handler throws", async () => {
    const fixture = await createTenantIsolationFixture();
    const key = `idem-${randomUUID()}`;

    await expect(
      withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
        withIdempotency(
          tx,
          {
            tenantId: fixture.tenantA.tenantId,
            actorMembershipId: fixture.tenantA.membershipId,
            ...claimFor(key, {}),
          },
          () => Promise.reject(new Error("handler blew up")),
        ),
      ),
    ).rejects.toThrow("handler blew up");

    // The claim rolled back with the handler's writes. Were it to survive, the
    // client's retry would hit an IN_PROGRESS row forever and the key would be
    // permanently unusable for an operation that never happened.
    const retried = await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      withIdempotency(
        tx,
        {
          tenantId: fixture.tenantA.tenantId,
          actorMembershipId: fixture.tenantA.membershipId,
          ...claimFor(key, {}),
        },
        () => Promise.resolve({ recovered: true }),
      ),
    );
    expect(retried).toEqual({ recovered: true });
  });

  it("scopes claims to the tenant", async () => {
    const fixture = await createTenantIsolationFixture();
    const key = `idem-${randomUUID()}`;

    await withTenantTx(tenantCtx(fixture.tenantA), async (tx) =>
      withIdempotency(
        tx,
        {
          tenantId: fixture.tenantA.tenantId,
          actorMembershipId: fixture.tenantA.membershipId,
          ...claimFor(key, {}),
        },
        () => Promise.resolve({ tenant: "a" }),
      ),
    );

    // The same key from another tenant is a different operation. RLS also keeps
    // tenant B from reading A's record, so a shared key must not surface A's
    // stored response to B.
    const forB = await withTenantTx(tenantCtx(fixture.tenantB), async (tx) =>
      withIdempotency(
        tx,
        {
          tenantId: fixture.tenantB.tenantId,
          actorMembershipId: fixture.tenantB.membershipId,
          ...claimFor(key, {}),
        },
        () => Promise.resolve({ tenant: "b" }),
      ),
    );
    expect(forB).toEqual({ tenant: "b" });
  });

  it("purges expired records", async () => {
    const fixture = await createTenantIsolationFixture();
    const key = `idem-${randomUUID()}`;

    await withTenantTx(tenantCtx(fixture.tenantA), async (tx) => {
      await withIdempotency(
        tx,
        {
          tenantId: fixture.tenantA.tenantId,
          actorMembershipId: fixture.tenantA.membershipId,
          ...claimFor(key, {}),
        },
        () => Promise.resolve({ ok: true }),
      );
      await tx.$executeRaw`
        UPDATE idempotency_records
           SET expires_at = now() - interval '1 hour'
         WHERE tenant_id = ${fixture.tenantA.tenantId}::uuid
           AND idempotency_key = ${key}
      `;
      await purgeExpiredIdempotencyRecords(tx);

      const rows = await tx.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::int AS count
          FROM idempotency_records
         WHERE tenant_id = ${fixture.tenantA.tenantId}::uuid
           AND idempotency_key = ${key}
      `;
      expect(rows[0]?.count).toBe(0);
    });
  });
});
